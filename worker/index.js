const supportClasses = new Set(["바드", "홀리나이트", "도화가", "발키리"]);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
const parseItemLevel = (value) => Number(String(value ?? "0").replaceAll(",", "")) || 0;

async function lostArkRoster(request, env) {
  const characterName = new URL(request.url).searchParams.get("characterName")?.trim();
  if (!characterName) return json({ message: "대표 캐릭터명을 입력해주세요." }, 400);
  if (!env.LOSTARK_API_JWT) return json({ message: "로스트아크 API 키가 설정되지 않았습니다." }, 503);
  const authorization = env.LOSTARK_API_JWT.toLowerCase().startsWith("bearer ") ? env.LOSTARK_API_JWT : `bearer ${env.LOSTARK_API_JWT}`;
  const response = await fetch(`https://developer-lostark.game.onstove.com/characters/${encodeURIComponent(characterName)}/siblings`, { headers: { accept: "application/json", authorization } });
  if (!response.ok) return json({ message: `로스트아크 API 조회 실패 (${response.status})` }, response.status);
  const profiles = await response.json();
  const characters = profiles.map((profile) => ({
    id: `${profile.ServerName}:${profile.CharacterName}`,
    name: profile.CharacterName,
    serverName: profile.ServerName,
    className: profile.CharacterClassName,
    role: supportClasses.has(profile.CharacterClassName) ? "서폿" : "딜러",
    itemLevel: parseItemLevel(profile.ItemAvgLevel),
  })).sort((left, right) => right.itemLevel - left.itemLevel);
  return characters.length ? json({ characters }) : json({ message: `원정대에서 '${characterName}' 캐릭터를 찾지 못했습니다.` }, 404);
}

async function kloaGuild(request) {
  const guildName = new URL(request.url).searchParams.get("guildName")?.trim();
  if (!guildName) return json({ message: "길드명을 입력해주세요." }, 400);
  const response = await fetch(`https://api.korlark.com/lostark/guilds/${encodeURIComponent(guildName)}`, { headers: { accept: "application/json" } });
  if (!response.ok) return json({ message: `길드 조회 실패 (${response.status})` }, response.status);
  const guild = await response.json();
  const characters = (guild.members ?? []).map((member) => ({
    name: member.name,
    itemLevel: Number(member.itemLevel) || 0,
    combatPower: Number(member.combatPower) || 0,
    isOwner: Boolean(member.isOwner),
  })).sort((left, right) => Number(right.isOwner) - Number(left.isOwner) || right.itemLevel - left.itemLevel || left.name.localeCompare(right.name, "ko"));
  return json({ name: guild.name ?? guildName, characters });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/lostark/roster") return await lostArkRoster(request, env);
      if (url.pathname === "/api/kloa/guild") return await kloaGuild(request);
    } catch (error) {
      return json({ message: `외부 API 연결 오류: ${error.message}` }, 502);
    }

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
