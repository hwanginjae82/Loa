const classIconFiles = {
  "디스트로이어": "destroyer",
  "워로드": "warlord",
  "버서커": "berserker",
  "홀리나이트": "holyknight",
  "슬레이어": "slayer",
  "발키리": "valkyrie",
  "바드": "bard",
  "서머너": "summoner",
  "아르카나": "arcana",
  "소서리스": "sorceress",
  "배틀마스터": "wardancer",
  "인파이터": "scrapper",
  "기공사": "soulfist",
  "창술사": "glaivier",
  "스트라이커": "striker",
  "브레이커": "breaker",
  "블레이드": "blade",
  "데모닉": "demonic",
  "리퍼": "reaper",
  "소울이터": "souleater",
  "건슬링어": "gunslinger",
  "블래스터": "artillerist",
  "스카우터": "scouter",
  "호크아이": "sharpshooter",
  "데빌헌터": "devilhunter",
  "도화가": "artist",
  "기상술사": "aeromancer",
  "환수사": "wildsoul",
  "가디언나이트": "guardianknight",
};

export function ClassIcon({ className, size = "normal" }) {
  const fileName = classIconFiles[className];
  if (!fileName) return null;
  const src = `/class-icons/${fileName}.webp`;
  return <img className={`class-icon ${size}`} src={src} alt="" aria-hidden="true" />;
}
