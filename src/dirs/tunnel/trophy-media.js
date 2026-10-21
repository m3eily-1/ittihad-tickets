// Trophy stories and videos for the trophy room — researched 2026-10-21, approved by Ahmed the same day; `official: false` videos are fan re-uploads and show a 'Fan archive' tag.
// Stories use only facts found in the listed sources (years, opponents, scores, scorers). Like trophies.js, they give no title totals.
// Every video id passed YouTube oEmbed on 2026-10-21 (exists + embeddable). `official: false` = fan/archive re-upload of
// broadcast footage (no official upload found); keep or drop per Ahmed. Full notes + alternates: _research/trophy-videos.md
export const APPROVED = true;   // Ahmed approved 2026-10-21: all stories (1988 scorer dropped), all 24 videos, fan uploads tagged
export const TROPHY_MEDIA = {
  acl: {
    story: "Ittihad were crowned champions of Asia in 2004, after one of the competition's great comebacks. They lost the first leg of the final 3–1 at home to South Korea's Seongnam Ilhwa Chunma. In the return leg in Seongnam on 1 December, Redha Tukar, Hamzah Idris, Mohammed Noor with two goals, and Manaf Abushgeer won it 5–0, and the title 6–3 on aggregate. A year later they did it again. A 1–1 draw away to Al Ain, with a late Mohamed Kallon penalty, was followed by a 4–2 win in Jeddah on 5 November 2005. Ittihad were back-to-back Asian champions and went on to the FIFA Club World Cup.",
    sources: [
      'https://en.wikipedia.org/wiki/2004_AFC_Champions_League',
      'https://en.wikipedia.org/wiki/2005_AFC_Champions_League_final',
      'https://en.wikipedia.org/wiki/Al-Ittihad_Club_(Jeddah)',
    ],
    videos: [
      { id: 'cxp4ply1d9w', title: 'Seongnam Ilhwa Chunma vs Al-Ittihad: AFC Champions League (2004  Final, 2nd Leg)', channel: 'The AFC Hub', kind: 'final', year: '2004', official: true },
      { id: 'PXSQ9_fhv_0', title: 'Al Ittihad vs Al Ain: AFC Champions League (2005 Final, 2nd Leg)', channel: 'The AFC Hub', kind: 'final', year: '2005', official: true },
      { id: 'jFHXNuCyun8', title: 'الاتحاد 4 × 2 العين الإماراتي نهائي دوري أبطال آسيا 2005 | الملخص + التتويج', channel: 'الإتحاد زمان - ittihadzman', kind: 'celebration', year: '2005', official: false },
    ],
  },
  league: {
    story: "Ittihad won their first Saudi league title in 1981–82. The late nineties began a golden era. In 1996–97 the league came with the Crown Prince Cup and the Federation Cup, and more titles followed in 1998–99, 1999–2000, 2000–01, 2002–03, 2006–07 and 2008–09. In 2022–23, under Nuno Espírito Santo, Ittihad sealed the title with a game to spare, winning 3–0 at Al-Fayha with goals from Ahmed Sharahili and Romarinho, who scored twice. Abderrazak Hamdallah was the league's top scorer. In 2024–25, under Laurent Blanc and captained by Karim Benzema, they clinched it with two games left, coming from behind to beat Al-Raed 3–1.",
    sources: [
      'https://en.wikipedia.org/wiki/Al-Ittihad_Club_(Jeddah)',
      'https://en.wikipedia.org/wiki/2022%E2%80%9323_Saudi_Pro_League',
      'https://gulfnews.com/sport/football/saudi-pro-league-ronaldos-first-season-ends-without-title-as-al-ittihad-wins-1.1685251137012',
      'https://en.wikipedia.org/wiki/2024%E2%80%9325_Saudi_Pro_League',
      'https://africa.espn.com/football/story/_/id/45167587/karim-benzema-al-ittihad-secure-saudi-pro-league-title',
    ],
    videos: [
      { id: 'HYqaLCLV-dQ', title: 'Al Ittihad crowned 2024/25 #RoshnSaudiLeague champions 🏆 | Highlights presented by Visit Saudi', channel: 'الدوري السعودي للمحترفين - Saudi Pro League', kind: 'final', year: '2024–25', official: true },
      { id: '5nCPu5o2Psc', title: 'الاتحاد بطلاً لدوري روشن السعودي 2022/2023 🏆💛🖤 | مراسم التتويج', channel: 'قناة نادي الاتحاد السعودي', kind: 'celebration', year: '2022–23', official: true },
      { id: 'O83CXVEWpIc', title: 'تتويج الاتحاد بطل دوري روشن 2024/25 ⚽🏆', channel: 'قناة نادي الاتحاد السعودي', kind: 'celebration', year: '2024–25', official: true },
    ],
  },
  kings: {
    story: "Ittihad first won the King's Cup in 1967, beating Al-Nassr in the final. After a 21-year wait they lifted it again in 1988, beating Al-Ettifaq 1–0 in Riyadh. In 2010 a goalless final against Al-Hilal went to penalties, and Ittihad scored all five to win 5–4. In 2013 they beat Al-Shabab 4–2 in Riyadh. In 2018, in front of 60,184 fans in Jeddah, they beat Al-Faisaly 3–1 after extra time. And in 2025 Karim Benzema scored twice and Houssem Aouar once in a 3–1 win over Al-Qadsiah in Jeddah, adding the cup to that season's league title.",
    sources: [
      'https://en.wikipedia.org/wiki/King%27s_Cup_(Saudi_Arabia)',
      'https://en.wikipedia.org/wiki/1988_King_Cup',
      'https://en.wikipedia.org/wiki/2010_King_Cup_of_Champions',
      'https://en.wikipedia.org/wiki/2013_King_Cup_of_Champions',
      'https://en.wikipedia.org/wiki/2018_King%27s_Cup_(Saudi_Arabia)',
      'https://en.wikipedia.org/wiki/2024%E2%80%9325_King%27s_Cup_(Saudi_Arabia)',
    ],
    videos: [
      { id: 'iXmFnbuzHOI', title: 'ملخص مباراة الاتحاد 3 - 1 القادسية | نهائي كأس خادم الحرمين الشريفين 2024-2025', channel: 'SSC TV', kind: 'final', year: '2025', official: true },
      { id: 'xxUp1XEMwik', title: 'تتويج نادي الاتحاد بكأس خادم الحرمين الشريفين 2025 🏆', channel: 'قناة نادي الاتحاد السعودي', kind: 'celebration', year: '2025', official: true },
      { id: 'd8qo8DuvuTw', title: 'ملخص مباراة الاتحاد والفيصلي في نهائي كأس خادم الحرمين الشريفين', channel: 'stc tv sports', kind: 'final', year: '2018', official: true },
    ],
  },
  crown: {
    story: "Ittihad's Crown Prince Cup story spans six decades. They won it in 1957–58, beating Al-Ahli 8–1 in the final, then again in 1958–59 and 1962–63. The 1991 final against Al-Nassr went to penalties, and Ittihad won the shoot-out 5–4. More wins followed in 1997, 2001 and 2004. Then came the last Crown Prince Cup final ever played, on 10 March 2017 in Riyadh, once again Ittihad against Al-Nassr. Mahmoud Kahraba scored after 16 minutes, the match ended 1–0, and Ittihad became the competition's last champions.",
    sources: [
      'https://en.wikipedia.org/wiki/Saudi_Crown_Prince_Cup',
      'https://en.wikipedia.org/wiki/2017_Saudi_Crown_Prince_Cup_final',
    ],
    videos: [
      { id: 'Nyv0DzGDHaY', title: 'ملخص مباراة النصر والاتحاد في نهائي كأس ولي العهد', channel: 'stc tv sports', kind: 'final', year: '2016–17', official: true },
      { id: '6Kzqby8Tfs4', title: 'الاتحاد يتوج بطلاً لكأس ولي العهد لعام 2017', channel: 'stc tv sports', kind: 'celebration', year: '2016–17', official: true },
    ],
  },
  cwc: {
    story: "Ittihad's first continental trophy was the 1998–99 Asian Cup Winners' Cup. They beat Qatar's Al Ahli 7–1 on aggregate and Uzbekistan's Pakhtakor 4–0, then went to the final four in Tokyo, where they beat Iraq's Al-Talaba 3–1 in the semi-final. In the final on 18 April 1999 they met South Korea's Chunnam Dragons. Ahmed Bahja scored a penalty and Mohammed Noor added a second, but Roh Sang-rae's two goals forced extra time. In the 105th minute Bahja scored the golden goal that won the cup 3–2.",
    sources: [
      'https://en.wikipedia.org/wiki/1998%E2%80%9399_Asian_Cup_Winners%27_Cup',
      'https://www.rsssf.org/tablesa/ascup99.html',
      'https://en.wikipedia.org/wiki/Al-Ittihad_Club_(Jeddah)',
    ],
    videos: [
      { id: 'bp0P08uD_gE', title: 'الاتحاد 3 × 2  جيونام الكوري الجنوبي نهائي كأس الكؤوس الآسيوية 1999  #الاتحاد_في_مثل_هذا_اليوم', channel: 'الإتحاد زمان - ittihadzman', kind: 'final', year: '1999', official: false },
      { id: 'rGLM7HZQV6U', title: 'احمد جميل كابتن نادي الاتحاد  يرفع كأس الكؤوس الاسيوية عام 1999م', channel: 'hanitti', kind: 'celebration', year: '1999', official: false },
    ],
  },
  arab: {
    story: "In 2005 Ittihad became Arab club champions, winning the 2004–05 Arab Champions League. On the way they knocked out Algeria's MC Alger on penalties in the quarter-finals. The two-legged final was against Tunisia's CS Sfaxien. In Sfax on 24 June 2005, Ibrahim Al-Shahrani scored twice for a 2–0 away win. A week later in Jeddah, an own goal and a strike from Mohammed Noor gave Ittihad a 2–1 victory, and the trophy, 4–1 on aggregate. It was the start of a remarkable year that ended with Ittihad retaining the AFC Champions League.",
    sources: [
      'https://en.wikipedia.org/wiki/2004%E2%80%9305_Arab_Champions_League',
      'https://en.wikipedia.org/wiki/Al-Ittihad_Club_(Jeddah)',
    ],
    videos: [
      { id: 'EsAZ_-2s_D0', title: 'الاتحاد 2 × 1 الصفاقسي التونسي نهائي دوري أبطال العرب 2005 #الاتحاد_في_مثل_هذا_اليوم', channel: 'الإتحاد زمان - ittihadzman', kind: 'final', year: '2005', official: false },
      { id: '4zK72Ic7vXI', title: 'الاتحاد 2 × 1 الصفاقسي التونسي نهائي دوري أبطال العرب 2005  | المباراة كاملة + التتويج', channel: 'الإتحاد زمان - ittihadzman', kind: 'celebration', year: '2005', official: false },
    ],
  },
  gcc: {
    story: "In early 1999 Jeddah hosted the 16th GCC Club Championship, a six-team round robin played between 25 January and 5 February. Ittihad won all five of their matches, scoring fifteen goals and conceding two. They finished ahead of Kuwait's Al-Salmiya to win the Gulf club title for the first time. It was part of a remarkable 1998–99 season in which Ittihad also won the Asian Cup Winners' Cup and the Saudi Federation Cup.",
    sources: [
      'https://en.wikipedia.org/wiki/16th_GCC_Club_Championship',
      'https://en.wikipedia.org/wiki/GFF_Gulf_Club_Champions_League',
      'https://en.wikipedia.org/wiki/Al-Ittihad_Club_(Jeddah)',
    ],
    videos: [
      { id: '98QRQre02nE', title: 'الاتحاد تتويج بطولة الخليج 99 م.wmv', channel: 'Hussam Madkhali', kind: 'celebration', year: '1999', official: false },
    ],
  },
  fed: {
    story: "The Saudi Federation Cup, later renamed the Prince Faisal bin Fahd Cup, gave Ittihad three trophies. The first came in 1985–86, when a goalless final against Al-Hilal went to penalties and Ittihad won the shoot-out 3–2. In 1996–97 they beat their Jeddah rivals Al-Ahli 3–1 in the final, completing a treble with the league and the Crown Prince Cup. In 1998–99 a 1–0 final win over Al-Shabab crowned a season that also brought the Asian Cup Winners' Cup and the Gulf club title.",
    sources: [
      'https://en.wikipedia.org/wiki/Prince_Faisal_bin_Fahd_Cup',
      'https://en.wikipedia.org/wiki/Al-Ittihad_Club_(Jeddah)',
    ],
    videos: [
      { id: 'u0RTG86jr2s', title: 'الاتحاد 1 × 0 الشباب نهائي كأس الاتحاد السعودي موسم 1999', channel: 'الإتحاد زمان - ittihadzman', kind: 'final', year: '1999', official: false },
    ],
  },
  super: {
    story: "The Saudi Super Cup expanded to four teams for its 2022 edition, which was played in Riyadh in January 2023. Ittihad beat Al-Nassr 3–1 in the semi-final, then met Al-Fayha in the final at King Fahd International Stadium on 29 January. Abderrazak Hamdallah scored in the third minute and again just after half-time to win it 2–0, and he was named the tournament's decisive player. It was Ittihad's first Saudi Super Cup, and the first trophy of a season that ended with the league title.",
    sources: [
      'https://en.wikipedia.org/wiki/2022_Saudi_Super_Cup',
      'https://en.wikipedia.org/wiki/2022_Saudi_Super_Cup_final',
    ],
    videos: [
      { id: 'WofnQYgo5p0', title: 'ملخص مباراة الاتحاد 2 × 0 الفيحاء | نهائي كأس السوبر السعودي 🏆💛🖤  |  تعليق حماد العنزي', channel: 'قناة نادي الاتحاد السعودي', kind: 'final', year: '2022', official: true },
      { id: '7Ij2rjzkhCM', title: 'الاتحاد بطلا لـكاس السوبر السعودي 2023  | مراسم التتويج  🏆💛🖤', channel: 'قناة نادي الاتحاد السعودي', kind: 'celebration', year: '2022', official: true },
      { id: 'dcasBYfvy0c', title: 'ملخص مباراة #الفيحاء_الاتحاد ( نهائي كأس السوبر السعودي )', channel: 'SSC TV', kind: 'final', year: '2022', official: true },
    ],
  },
  segypt: {
    story: "The Saudi-Egyptian Super Cup was an occasional competition that brought together the champions of Saudi Arabia and Egypt, and Ittihad won it twice. In 2001 they beat Egypt's Al Ahly 3–2 after extra time. In 2003, at the Prince Abdullah Al-Faisal Stadium in Jeddah on 4 July, they beat Ismaily 1–0, with Hamzah Idris scoring a golden goal in the 112th minute.",
    sources: [
      'https://en.wikipedia.org/wiki/Saudi-Egyptian_Super_Cup',
      'https://en.wikipedia.org/wiki/2003_Saudi-Egyptian_Super_Cup',
    ],
    videos: [
      { id: '45p1z99mTwg', title: 'الاتحاد 3 × 2 الأهلي المصري كأس السوبر السعودي المصري 2001 #الاتحاد_في_مثل_هذا_اليوم', channel: 'الإتحاد زمان - ittihadzman', kind: 'final', year: '2001', official: false },
      { id: 'so15EPfnneg', title: 'الاتحاد بطل كاس السوبر السعودي المصري 2001', channel: 'شـمـس الاتـحـاد القناه الاولى', kind: 'celebration', year: '2001', official: false },
      { id: 'cYX9UXI_AUo', title: 'هدف حمزة ادريس الذهبي في الاسماعيلي المصري _ كأس السوبر السعودي المصري', channel: 'لحن& العميد 1', kind: 'final', year: '2003', official: false },
    ],
  },
};
