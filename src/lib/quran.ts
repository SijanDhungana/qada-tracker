/**
 * The 114 surahs, for picking what was read rather than counting how many.
 *
 * Names are the common transliterations; `meaning` is a plain English gloss to
 * help someone find a surah they know by its English name. `ayahs` is there so
 * the picker can hint at length — it is never used to judge whether a reading
 * "counts".
 */
export type Surah = {
  number: number;
  name: string;
  meaning: string;
  ayahs: number;
};

export const SURAHS: Surah[] = [
  { number: 1, name: "Al-Fatihah", meaning: "The Opening", ayahs: 7 },
  { number: 2, name: "Al-Baqarah", meaning: "The Cow", ayahs: 286 },
  { number: 3, name: "Aal-Imran", meaning: "The Family of Imran", ayahs: 200 },
  { number: 4, name: "An-Nisa", meaning: "The Women", ayahs: 176 },
  { number: 5, name: "Al-Ma'idah", meaning: "The Table Spread", ayahs: 120 },
  { number: 6, name: "Al-An'am", meaning: "The Cattle", ayahs: 165 },
  { number: 7, name: "Al-A'raf", meaning: "The Heights", ayahs: 206 },
  { number: 8, name: "Al-Anfal", meaning: "The Spoils of War", ayahs: 75 },
  { number: 9, name: "At-Tawbah", meaning: "The Repentance", ayahs: 129 },
  { number: 10, name: "Yunus", meaning: "Jonah", ayahs: 109 },
  { number: 11, name: "Hud", meaning: "Hud", ayahs: 123 },
  { number: 12, name: "Yusuf", meaning: "Joseph", ayahs: 111 },
  { number: 13, name: "Ar-Ra'd", meaning: "The Thunder", ayahs: 43 },
  { number: 14, name: "Ibrahim", meaning: "Abraham", ayahs: 52 },
  { number: 15, name: "Al-Hijr", meaning: "The Rocky Tract", ayahs: 99 },
  { number: 16, name: "An-Nahl", meaning: "The Bee", ayahs: 128 },
  { number: 17, name: "Al-Isra", meaning: "The Night Journey", ayahs: 111 },
  { number: 18, name: "Al-Kahf", meaning: "The Cave", ayahs: 110 },
  { number: 19, name: "Maryam", meaning: "Mary", ayahs: 98 },
  { number: 20, name: "Ta-Ha", meaning: "Ta-Ha", ayahs: 135 },
  { number: 21, name: "Al-Anbiya", meaning: "The Prophets", ayahs: 112 },
  { number: 22, name: "Al-Hajj", meaning: "The Pilgrimage", ayahs: 78 },
  { number: 23, name: "Al-Mu'minun", meaning: "The Believers", ayahs: 118 },
  { number: 24, name: "An-Nur", meaning: "The Light", ayahs: 64 },
  { number: 25, name: "Al-Furqan", meaning: "The Criterion", ayahs: 77 },
  { number: 26, name: "Ash-Shu'ara", meaning: "The Poets", ayahs: 227 },
  { number: 27, name: "An-Naml", meaning: "The Ant", ayahs: 93 },
  { number: 28, name: "Al-Qasas", meaning: "The Stories", ayahs: 88 },
  { number: 29, name: "Al-Ankabut", meaning: "The Spider", ayahs: 69 },
  { number: 30, name: "Ar-Rum", meaning: "The Romans", ayahs: 60 },
  { number: 31, name: "Luqman", meaning: "Luqman", ayahs: 34 },
  { number: 32, name: "As-Sajdah", meaning: "The Prostration", ayahs: 30 },
  { number: 33, name: "Al-Ahzab", meaning: "The Combined Forces", ayahs: 73 },
  { number: 34, name: "Saba", meaning: "Sheba", ayahs: 54 },
  { number: 35, name: "Fatir", meaning: "The Originator", ayahs: 45 },
  { number: 36, name: "Ya-Sin", meaning: "Ya Sin", ayahs: 83 },
  { number: 37, name: "As-Saffat", meaning: "Those Ranged in Ranks", ayahs: 182 },
  { number: 38, name: "Sad", meaning: "Sad", ayahs: 88 },
  { number: 39, name: "Az-Zumar", meaning: "The Troops", ayahs: 75 },
  { number: 40, name: "Ghafir", meaning: "The Forgiver", ayahs: 85 },
  { number: 41, name: "Fussilat", meaning: "Explained in Detail", ayahs: 54 },
  { number: 42, name: "Ash-Shura", meaning: "The Consultation", ayahs: 53 },
  { number: 43, name: "Az-Zukhruf", meaning: "The Ornaments of Gold", ayahs: 89 },
  { number: 44, name: "Ad-Dukhan", meaning: "The Smoke", ayahs: 59 },
  { number: 45, name: "Al-Jathiyah", meaning: "The Crouching", ayahs: 37 },
  { number: 46, name: "Al-Ahqaf", meaning: "The Sand Dunes", ayahs: 35 },
  { number: 47, name: "Muhammad", meaning: "Muhammad", ayahs: 38 },
  { number: 48, name: "Al-Fath", meaning: "The Victory", ayahs: 29 },
  { number: 49, name: "Al-Hujurat", meaning: "The Rooms", ayahs: 18 },
  { number: 50, name: "Qaf", meaning: "Qaf", ayahs: 45 },
  { number: 51, name: "Adh-Dhariyat", meaning: "The Winnowing Winds", ayahs: 60 },
  { number: 52, name: "At-Tur", meaning: "The Mount", ayahs: 49 },
  { number: 53, name: "An-Najm", meaning: "The Star", ayahs: 62 },
  { number: 54, name: "Al-Qamar", meaning: "The Moon", ayahs: 55 },
  { number: 55, name: "Ar-Rahman", meaning: "The Most Merciful", ayahs: 78 },
  { number: 56, name: "Al-Waqi'ah", meaning: "The Inevitable", ayahs: 96 },
  { number: 57, name: "Al-Hadid", meaning: "The Iron", ayahs: 29 },
  { number: 58, name: "Al-Mujadila", meaning: "The Pleading Woman", ayahs: 22 },
  { number: 59, name: "Al-Hashr", meaning: "The Exile", ayahs: 24 },
  { number: 60, name: "Al-Mumtahanah", meaning: "She Who Is Examined", ayahs: 13 },
  { number: 61, name: "As-Saff", meaning: "The Ranks", ayahs: 14 },
  { number: 62, name: "Al-Jumu'ah", meaning: "Friday", ayahs: 11 },
  { number: 63, name: "Al-Munafiqun", meaning: "The Hypocrites", ayahs: 11 },
  { number: 64, name: "At-Taghabun", meaning: "Mutual Disillusion", ayahs: 18 },
  { number: 65, name: "At-Talaq", meaning: "Divorce", ayahs: 12 },
  { number: 66, name: "At-Tahrim", meaning: "The Prohibition", ayahs: 12 },
  { number: 67, name: "Al-Mulk", meaning: "The Sovereignty", ayahs: 30 },
  { number: 68, name: "Al-Qalam", meaning: "The Pen", ayahs: 52 },
  { number: 69, name: "Al-Haqqah", meaning: "The Reality", ayahs: 52 },
  { number: 70, name: "Al-Ma'arij", meaning: "The Ascending Stairways", ayahs: 44 },
  { number: 71, name: "Nuh", meaning: "Noah", ayahs: 28 },
  { number: 72, name: "Al-Jinn", meaning: "The Jinn", ayahs: 28 },
  { number: 73, name: "Al-Muzzammil", meaning: "The Enshrouded One", ayahs: 20 },
  { number: 74, name: "Al-Muddaththir", meaning: "The Cloaked One", ayahs: 56 },
  { number: 75, name: "Al-Qiyamah", meaning: "The Resurrection", ayahs: 40 },
  { number: 76, name: "Al-Insan", meaning: "Man", ayahs: 31 },
  { number: 77, name: "Al-Mursalat", meaning: "The Emissaries", ayahs: 50 },
  { number: 78, name: "An-Naba", meaning: "The Tidings", ayahs: 40 },
  { number: 79, name: "An-Nazi'at", meaning: "Those Who Pull Out", ayahs: 46 },
  { number: 80, name: "Abasa", meaning: "He Frowned", ayahs: 42 },
  { number: 81, name: "At-Takwir", meaning: "The Overthrowing", ayahs: 29 },
  { number: 82, name: "Al-Infitar", meaning: "The Cleaving", ayahs: 19 },
  { number: 83, name: "Al-Mutaffifin", meaning: "The Defrauding", ayahs: 36 },
  { number: 84, name: "Al-Inshiqaq", meaning: "The Splitting Open", ayahs: 25 },
  { number: 85, name: "Al-Buruj", meaning: "The Great Stars", ayahs: 22 },
  { number: 86, name: "At-Tariq", meaning: "The Nightcomer", ayahs: 17 },
  { number: 87, name: "Al-A'la", meaning: "The Most High", ayahs: 19 },
  { number: 88, name: "Al-Ghashiyah", meaning: "The Overwhelming", ayahs: 26 },
  { number: 89, name: "Al-Fajr", meaning: "The Dawn", ayahs: 30 },
  { number: 90, name: "Al-Balad", meaning: "The City", ayahs: 20 },
  { number: 91, name: "Ash-Shams", meaning: "The Sun", ayahs: 15 },
  { number: 92, name: "Al-Layl", meaning: "The Night", ayahs: 21 },
  { number: 93, name: "Ad-Duha", meaning: "The Morning Hours", ayahs: 11 },
  { number: 94, name: "Ash-Sharh", meaning: "The Relief", ayahs: 8 },
  { number: 95, name: "At-Tin", meaning: "The Fig", ayahs: 8 },
  { number: 96, name: "Al-Alaq", meaning: "The Clot", ayahs: 19 },
  { number: 97, name: "Al-Qadr", meaning: "The Power", ayahs: 5 },
  { number: 98, name: "Al-Bayyinah", meaning: "The Clear Proof", ayahs: 8 },
  { number: 99, name: "Az-Zalzalah", meaning: "The Earthquake", ayahs: 8 },
  { number: 100, name: "Al-Adiyat", meaning: "The Courser", ayahs: 11 },
  { number: 101, name: "Al-Qari'ah", meaning: "The Calamity", ayahs: 11 },
  { number: 102, name: "At-Takathur", meaning: "The Rivalry in Increase", ayahs: 8 },
  { number: 103, name: "Al-Asr", meaning: "The Declining Day", ayahs: 3 },
  { number: 104, name: "Al-Humazah", meaning: "The Slanderer", ayahs: 9 },
  { number: 105, name: "Al-Fil", meaning: "The Elephant", ayahs: 5 },
  { number: 106, name: "Quraysh", meaning: "Quraysh", ayahs: 4 },
  { number: 107, name: "Al-Ma'un", meaning: "The Small Kindnesses", ayahs: 7 },
  { number: 108, name: "Al-Kawthar", meaning: "The Abundance", ayahs: 3 },
  { number: 109, name: "Al-Kafirun", meaning: "The Disbelievers", ayahs: 6 },
  { number: 110, name: "An-Nasr", meaning: "The Divine Support", ayahs: 3 },
  { number: 111, name: "Al-Masad", meaning: "The Palm Fibre", ayahs: 5 },
  { number: 112, name: "Al-Ikhlas", meaning: "The Sincerity", ayahs: 4 },
  { number: 113, name: "Al-Falaq", meaning: "The Daybreak", ayahs: 5 },
  { number: 114, name: "An-Nas", meaning: "Mankind", ayahs: 6 },
];

export const SURAH_COUNT = SURAHS.length;

const BY_NUMBER = new Map(SURAHS.map((surah) => [surah.number, surah]));

export function surahByNumber(number: number): Surah | undefined {
  return BY_NUMBER.get(number);
}

export function isSurahNumber(value: unknown): value is number {
  return Number.isInteger(value) && BY_NUMBER.has(value as number);
}

/** "18. Al-Kahf" */
export function surahLabel(number: number): string {
  const surah = surahByNumber(number);
  return surah ? `${surah.number}. ${surah.name}` : `Surah ${number}`;
}

/**
 * Matches on number, transliterated name, or English meaning, ignoring the
 * apostrophes and hyphens people leave out when typing ("almaidah", "ya sin").
 */
function normalise(value: string): string {
  return value.toLowerCase().replace(/['’\-\s]/g, "");
}

export function searchSurahs(query: string): Surah[] {
  const trimmed = query.trim();
  if (trimmed === "") return SURAHS;

  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    const exact = SURAHS.filter((surah) => String(surah.number).startsWith(trimmed));
    if (exact.length > 0) return exact;
  }

  const needle = normalise(trimmed);
  return SURAHS.filter(
    (surah) =>
      normalise(surah.name).includes(needle) ||
      normalise(surah.meaning).includes(needle),
  );
}

/** "Al-Fatihah, Al-Kahf and 2 more" — kept short enough for a summary line. */
export function describeSurahs(numbers: number[], limit = 2): string {
  const named = [...numbers]
    .sort((a, b) => a - b)
    .map((number) => surahByNumber(number)?.name ?? `Surah ${number}`);

  if (named.length === 0) return "";
  if (named.length <= limit) return named.join(", ");

  const shown = named.slice(0, limit).join(", ");
  const rest = named.length - limit;
  return `${shown} and ${rest} more`;
}
