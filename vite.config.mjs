import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const supportClasses = new Set(["바드", "홀리나이트", "도화가", "발키리"]);

function parseItemLevel(value) {
  return Number(String(value ?? "0").replaceAll(",", "")) || 0;
}

function lostArkRosterApi(token) {
  return {
    name: "lostark-roster-api",
    configureServer(server) {
      server.middlewares.use("/api/lostark/roster", async (request, response) => {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        const requestUrl = new URL(request.url, "http://localhost");
        const characterName = requestUrl.searchParams.get("characterName")?.trim();
        if (!characterName) {
          response.statusCode = 400;
          response.end(JSON.stringify({ message: "대표 캐릭터명을 입력해주세요." }));
          return;
        }
        if (!token) {
          response.statusCode = 503;
          response.end(JSON.stringify({ message: "LOSTARK_API_JWT가 설정되지 않았습니다. .env.local에 API 키를 넣은 뒤 미리보기를 다시 시작해주세요." }));
          return;
        }
        try {
          const authorization = token.toLowerCase().startsWith("bearer ") ? token : `bearer ${token}`;
          const apiResponse = await fetch(`https://developer-lostark.game.onstove.com/characters/${encodeURIComponent(characterName)}/siblings`, {
            headers: { accept: "application/json", authorization },
          });
          if (!apiResponse.ok) {
            response.statusCode = apiResponse.status;
            response.end(JSON.stringify({ message: `로스트아크 API 조회 실패 (${apiResponse.status})` }));
            return;
          }
          const profiles = await apiResponse.json();
          const characters = profiles
            .map((profile) => ({
              id: `${profile.ServerName}:${profile.CharacterName}`,
              name: profile.CharacterName,
              serverName: profile.ServerName,
              className: profile.CharacterClassName,
              role: supportClasses.has(profile.CharacterClassName) ? "서폿" : "딜러",
              itemLevel: parseItemLevel(profile.ItemAvgLevel),
            }))
            .sort((left, right) => right.itemLevel - left.itemLevel);
          if (!characters.length) {
            response.statusCode = 404;
            response.end(JSON.stringify({ message: `실제 캐릭터 '${characterName}'을 찾지 못했습니다. 캐릭터명을 정확히 입력해주세요.` }));
            return;
          }
          response.statusCode = 200;
          response.end(JSON.stringify({ characters }));
        } catch (error) {
          response.statusCode = 502;
          response.end(JSON.stringify({ message: `로스트아크 API 연결 오류: ${error.message}` }));
        }
      });
    },
  };
}

function kloaGuildApi() {
  return {
    name: "kloa-guild-api",
    configureServer(server) {
      server.middlewares.use("/api/kloa/guild", async (request, response) => {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        const requestUrl = new URL(request.url, "http://localhost");
        const guildName = requestUrl.searchParams.get("guildName")?.trim();
        if (!guildName) {
          response.statusCode = 400;
          response.end(JSON.stringify({ message: "길드명을 입력해주세요." }));
          return;
        }
        try {
          const apiResponse = await fetch(`https://api.korlark.com/lostark/guilds/${encodeURIComponent(guildName)}`, {
            headers: { accept: "application/json" },
          });
          if (!apiResponse.ok) {
            response.statusCode = apiResponse.status;
            response.end(JSON.stringify({ message: `길드 조회 실패 (${apiResponse.status})` }));
            return;
          }
          const guild = await apiResponse.json();
          const characters = (guild.members ?? [])
            .map((member) => ({
              name: member.name,
              itemLevel: Number(member.itemLevel) || 0,
              combatPower: Number(member.combatPower) || 0,
              isOwner: Boolean(member.isOwner),
            }))
            .sort((left, right) => Number(right.isOwner) - Number(left.isOwner) || right.itemLevel - left.itemLevel || left.name.localeCompare(right.name, "ko"));
          response.statusCode = 200;
          response.end(JSON.stringify({ name: guild.name ?? guildName, characters }));
        } catch (error) {
          response.statusCode = 502;
          response.end(JSON.stringify({ message: `KLOA 길드 연결 오류: ${error.message}` }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    build: { outDir: "dist/client" },
    optimizeDeps: { include: ["react", "react-dom/client"] },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      warmup: { clientFiles: ["./src/main.jsx"] },
    },
    plugins: [react(), lostArkRosterApi(env.LOSTARK_API_JWT), kloaGuildApi()],
  };
});
