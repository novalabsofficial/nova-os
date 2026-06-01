// Shared data constants. Anything that's a static value used across multiple
// files lives here so we don't end up with circular imports or duplicated lists.

export const COLL = "nova_storage";

// v7.6: single source of truth for the human-readable version string. Used
// by the boot screen, login footer, terminal version command, and the Store
// header. Update this when you do a version sweep — package.json /
// tauri.conf.json still need their own bumps but at least *display* text
// won't drift again. Format: "<major>.<minor>".
export const NOVA_VERSION = "10.5";

// Widget metadata: label/emoji + minimum size constraints used by WidgetShell.
export const WIDGET_CONFIGS = {
  clock:    { label:"Clock",        emoji:"🕐", minW:180, minH:80  },
  weather:  { label:"Weather",      emoji:"🌤️", minW:170, minH:120 },
  notesw:   { label:"Quick Notes",  emoji:"📝", minW:200, minH:160 },
  tasksw:   { label:"Tasks",        emoji:"✅", minW:200, minH:160 },
  calendar: { label:"Calendar",     emoji:"📅", minW:240, minH:220 },
  sysinfo:  { label:"System Info",  emoji:"💻", minW:180, minH:110 },
  // v8.1: battery widget reads navigator.getBattery(). On browsers/devices
  // where it's unsupported or always shows 100%+charging (no battery
  // present), the widget renders a one-line "no battery" message.
  battery:  { label:"Battery",      emoji:"🔋", minW:180, minH:90  },
  // v9.5: Pomodoro — 25/5 focus timer. State is local to the widget
  // (no Firestore round-trip needed) so it survives a re-render but not
  // a refresh. Soft chime plays at the end of each interval.
  pomodoro: { label:"Pomodoro",     emoji:"🍅", minW:220, minH:200 },
};

// Initial widget positions/sizes for a freshly-registered account.
export const DEFAULT_WIDGET_STATE = {
  clock:    { x:200, y:80,  w:240, h:112 },
  weather:  { x:450, y:80,  w:200, h:158 },
  notesw:   { x:200, y:220, w:260, h:280 },
  tasksw:   { x:480, y:220, w:260, h:280 },
  calendar: { x:200, y:220, w:280, h:264 },
  sysinfo:  { x:490, y:220, w:220, h:140 },
  battery:  { x:730, y:80,  w:200, h:100 },
  pomodoro: { x:730, y:200, w:240, h:240 },
};

// Default open size per app type. App ids that aren't listed get {w:520,h:480}.
export const DEFAULT_SIZES = {
  // v9.5: tasks bumped to 660×560 for the new two-pane (rail + main) layout.
  // Calendar bumped to 760×620 to fit the new mini-month + agenda sidebar.
  notes:{w:500,h:520},tasks:{w:660,h:560},files:{w:540,h:520},
  paint:{w:940,h:660},browser:{w:760,h:620},screenshot:{w:740,h:600},
  snake:{w:460,h:560},"2048":{w:480,h:580},
  store:{w:680,h:600},terminal:{w:720,h:500},
  settings:{w:480,h:640},profile:{w:440,h:540},chat:{w:480,h:580},
  // 5.1 additions
  // v9.5: calculator bumped to 640×620 for the new multi-mode layout with
  // a sidebar of calculator types (Standard / Scientific / Programmer /
  // Converter). The content stays max-width-capped so fullscreen doesn't
  // stretch buttons into ugly rectangles.
  calculator:{w:640,h:620},clock:{w:480,h:520},
  minesweeper:{w:520,h:600},wordle:{w:430,h:600},tetris:{w:340,h:620},
  pdf:{w:680,h:680},music:{w:480,h:560},calendar:{w:780,h:620},
  atmos:{w:680,h:640},
  // 5.2
  novaai:{w:760,h:640},
  // 7.4 game additions
  tictactoe:{w:380,h:560},
  pong:{w:580,h:560},
  flappy:{w:380,h:680},
  invaders:{w:520,h:680},
  pacman:{w:520,h:680},
  chess:{w:740,h:680},
  // v8.0 round-3
  photos:{w:760,h:600},
  // v9.7
  slides:{w:880,h:620},
  // v10.x — Asset Studio (decal/asset editor)
  assetstudio:{w:980,h:700},
};

// The master app list — drives the desktop, start menu, and store icons.
export const APPS = [
  {id:"notes",   icon:"📝",label:"Notes",   desc:"Write & save notes"},
  {id:"tasks",   icon:"✅",label:"Tasks",   desc:"Manage to-dos"},
  {id:"files",   icon:"📁",label:"Files",   desc:"Browse your files"},
  {id:"paint",   icon:"🎨",label:"Paint",   desc:"Draw & create"},
  {id:"browser", icon:"🌐",label:"Browser", desc:"Nova Search & Browse"},
  {id:"snake",   icon:"🐍",label:"Snake",   desc:"Classic snake game"},
  {id:"2048",    icon:"🎮",label:"2048",    desc:"Sliding tile puzzle"},
  {id:"store",   icon:"🏪",label:"Store",   desc:"Nova App Store"},
  {id:"chat",    icon:"💬",label:"Chat",    desc:"Global Nova chat"},
  {id:"terminal",icon:"💻",label:"Terminal",desc:"System terminal"},
  {id:"settings",icon:"⚙️",label:"Settings",desc:"Customize Nova OS"},
  {id:"profile", icon:"👤",label:"Profile", desc:"Your account"},
  // 5.1 additions
  {id:"calculator", icon:"🔢",label:"Calculator", desc:"Quick math"},
  {id:"clock",      icon:"⏰",label:"Clock",      desc:"World clock, stopwatch, timer"},
  {id:"calendar",   icon:"📅",label:"Calendar",   desc:"Schedule events"},
  {id:"music",      icon:"🎵",label:"Music",      desc:"Play local audio files"},
  {id:"pdf",        icon:"📄",label:"PDF Viewer", desc:"Read PDFs in-app"},
  {id:"atmos",      icon:"🌤️",label:"Atmos",     desc:"Weather, forecast & alerts"},
  {id:"minesweeper",icon:"💣",label:"Minesweeper",desc:"Classic mine-grid puzzle"},
  {id:"wordle",     icon:"🟩",label:"Wordle",     desc:"Daily 5-letter word puzzle"},
  {id:"tetris",     icon:"🟪",label:"Tetris",     desc:"Falling-block classic"},
  // 5.2
  {id:"novaai",     icon:"✨",label:"Nova AI",    desc:"Chat with Claude or ChatGPT (BYOK)"},
  // 7.4 games
  {id:"tictactoe",  icon:"❌",label:"Tic-Tac-Toe", desc:"You vs an unbeatable AI"},
  {id:"pong",       icon:"🏓",label:"Pong",        desc:"Classic paddle vs AI"},
  {id:"flappy",     icon:"🐦",label:"Flappy Bird", desc:"One-tap arcade staple"},
  {id:"invaders",   icon:"👾",label:"Space Invaders", desc:"Shoot the descending aliens"},
  {id:"pacman",     icon:"🟡",label:"Pac-Man",     desc:"Pellets, ghosts, classic maze"},
  {id:"chess",      icon:"♟️",label:"Chess",       desc:"Online multiplayer vs other Nova users"},
  // v8.0
  {id:"photos",     icon:"📷",label:"Photos",      desc:"Browse photos from your device"},
  // v8.6
  {id:"screenshot", icon:"📸",label:"Screenshot",  desc:"Capture & annotate your screen"},
  // v9.7
  {id:"slides",     icon:"📊",label:"Slides",      desc:"Build & present slide decks"},
  {id:"assetstudio",icon:"🪄",label:"Asset Studio", desc:"Decals, shapes & transparent PNGs"},
];

// Curated catalog of external apps shown in the Store's "Official" tab.
// domain enables Clearbit logo lookup.
export const STORE_CATALOG = [
  {id:"roblox",    name:"Roblox",       domain:"roblox.com",          icon:"🟥",cat:"Games", url:"https://www.roblox.com",                 newTab:true, badge:"↗ New Tab",desc:"World's leading gaming platform"},
  {id:"xbox",      name:"Xbox Cloud",   domain:"xbox.com",            icon:"🎮",cat:"Games", url:"https://www.xbox.com/en-US/play",        newTab:true, badge:"↗ New Tab",desc:"Stream Xbox Game Pass titles in your browser"},
  {id:"steam",     name:"Steam",        domain:"steampowered.com",    icon:"🎯",cat:"Games", url:"https://store.steampowered.com",         newTab:true, badge:"↗ New Tab",desc:"The ultimate PC gaming destination"},
  {id:"ps",        name:"PlayStation",  domain:"playstation.com",     icon:"🔵",cat:"Games", url:"https://www.playstation.com/en-us/ps-now/",newTab:true,badge:"↗ New Tab",desc:"PlayStation cloud gaming"},
  {id:"itchio",    name:"itch.io",      domain:"itch.io",             icon:"🕹️",cat:"Games", url:"https://itch.io",                        newTab:false,badge:"✓ In-App",desc:"Thousands of free indie & browser games"},
  {id:"poki",      name:"Poki",         domain:"poki.com",            icon:"🎪",cat:"Games", url:"https://poki.com",                       newTab:false,badge:"✓ In-App",desc:"Free online browser games"},
  {id:"crazygames",name:"CrazyGames",   domain:"crazygames.com",      icon:"🃏",cat:"Games", url:"https://www.crazygames.com",             newTab:false,badge:"✓ In-App",desc:"Hundreds of free browser games"},
  {id:"youtube",   name:"YouTube",      domain:"youtube.com",         icon:"▶️", cat:"Media", url:"https://www.youtube.com",                newTab:true, badge:"↗ New Tab",desc:"Watch, share, and create videos"},
  {id:"spotify",   name:"Spotify",      domain:"spotify.com",         icon:"🎵",cat:"Media", url:"https://open.spotify.com",               newTab:true, badge:"↗ New Tab",desc:"Stream 100M+ songs and podcasts"},
  {id:"twitch",    name:"Twitch",       domain:"twitch.tv",           icon:"💜",cat:"Media", url:"https://www.twitch.tv",                  newTab:true, badge:"↗ New Tab",desc:"Live streaming for gaming and more"},
  {id:"soundcloud",name:"SoundCloud",   domain:"soundcloud.com",      icon:"🎧",cat:"Media", url:"https://soundcloud.com",                 newTab:false,badge:"✓ In-App",desc:"Discover and stream independent music"},
  {id:"github",    name:"GitHub",       domain:"github.com",          icon:"🐙",cat:"Tools", url:"https://github.com",                     newTab:true, badge:"↗ New Tab",desc:"Code hosting and collaboration"},
  {id:"figma",     name:"Figma",        domain:"figma.com",           icon:"🎨",cat:"Tools", url:"https://www.figma.com",                  newTab:true, badge:"↗ New Tab",desc:"Collaborative UI design tool"},
  {id:"notion",    name:"Notion",       domain:"notion.so",           icon:"📓",cat:"Tools", url:"https://www.notion.so",                  newTab:true, badge:"↗ New Tab",desc:"All-in-one notes and docs workspace"},
  {id:"codepen",   name:"CodePen",      domain:"codepen.io",          icon:"✏️", cat:"Tools", url:"https://codepen.io",                     newTab:false,badge:"✓ In-App",desc:"Front-end coding environment"},
  {id:"discord",   name:"Discord",      domain:"discord.com",         icon:"💬",cat:"Social",url:"https://discord.com/app",                newTab:true, badge:"↗ New Tab",desc:"Chat, voice, and communities"},
  {id:"reddit",    name:"Reddit",       domain:"reddit.com",          icon:"🤖",cat:"Social",url:"https://www.reddit.com",                 newTab:true, badge:"↗ New Tab",desc:"The front page of the internet"},
  {id:"twitter",   name:"X / Twitter",  domain:"x.com",               icon:"🐦",cat:"Social",url:"https://x.com",                          newTab:true, badge:"↗ New Tab",desc:"Real-time news and conversation"},
  {id:"hn",        name:"Hacker News",  domain:"ycombinator.com",     icon:"🟠",cat:"News",  url:"https://news.ycombinator.com",           newTab:false,badge:"✓ In-App",desc:"Tech news, startups, programming"},
  {id:"wiki",      name:"Wikipedia",    domain:"wikipedia.org",       icon:"📚",cat:"News",  url:"https://en.m.wikipedia.org",             newTab:false,badge:"✓ In-App",desc:"Free encyclopedia"},
  {id:"arxiv",     name:"arXiv",        domain:"arxiv.org",           icon:"🔬",cat:"News",  url:"https://arxiv.org",                      newTab:false,badge:"✓ In-App",desc:"Open-access research papers"},
  // v8.4: expanded catalog — popular games + apps people actually use.
  {id:"epicgames", name:"Epic Games",   domain:"epicgames.com",       icon:"🎮",cat:"Games", url:"https://store.epicgames.com",            newTab:true, badge:"↗ New Tab",desc:"Games store and home of Fortnite & Unreal Engine"},
  {id:"coolmath",  name:"Coolmath Games",domain:"coolmathgames.com",  icon:"➗",cat:"Games", url:"https://www.coolmathgames.com",          newTab:true, badge:"↗ New Tab",desc:"Brain-training logic, math and puzzle games"},
  {id:"miniclip",  name:"Miniclip",     domain:"miniclip.com",        icon:"🎯",cat:"Games", url:"https://www.miniclip.com",               newTab:true, badge:"↗ New Tab",desc:"Play the best free online games"},
  {id:"kongregate",name:"Kongregate",   domain:"kongregate.com",      icon:"🎲",cat:"Games", url:"https://www.kongregate.com",             newTab:true, badge:"↗ New Tab",desc:"Thousands of free browser games"},
  {id:"newgrounds",name:"Newgrounds",   domain:"newgrounds.com",      icon:"🅽",cat:"Games", url:"https://www.newgrounds.com",             newTab:true, badge:"↗ New Tab",desc:"Games, art, music and animation by everyone"},
  {id:"lichess",   name:"Lichess",      domain:"lichess.org",         icon:"♟️",cat:"Games", url:"https://lichess.org",                    newTab:true, badge:"↗ New Tab",desc:"Free, open-source online chess"},
  {id:"netflix",   name:"Netflix",      domain:"netflix.com",         icon:"🎬",cat:"Media", url:"https://www.netflix.com",                newTab:true, badge:"↗ New Tab",desc:"Watch TV shows and movies"},
  {id:"disney",    name:"Disney+",      domain:"disneyplus.com",      icon:"🏰",cat:"Media", url:"https://www.disneyplus.com",             newTab:true, badge:"↗ New Tab",desc:"Disney, Pixar, Marvel, Star Wars & more"},
  {id:"primevideo",name:"Prime Video",  domain:"primevideo.com",      icon:"📺",cat:"Media", url:"https://www.primevideo.com",             newTab:true, badge:"↗ New Tab",desc:"Movies and TV included with Prime"},
  {id:"applemusic",name:"Apple Music",  domain:"music.apple.com",     icon:"🎵",cat:"Media", url:"https://music.apple.com",                newTab:true, badge:"↗ New Tab",desc:"Stream over 100 million songs"},
  {id:"vimeo",     name:"Vimeo",        domain:"vimeo.com",           icon:"🎥",cat:"Media", url:"https://vimeo.com",                      newTab:true, badge:"↗ New Tab",desc:"High-quality video for creators"},
  {id:"hulu",      name:"Hulu",         domain:"hulu.com",            icon:"📺",cat:"Media", url:"https://www.hulu.com",                   newTab:true, badge:"↗ New Tab",desc:"Stream current shows, movies and originals"},
  {id:"gdrive",    name:"Google Drive", domain:"drive.google.com",    icon:"📁",cat:"Tools", url:"https://drive.google.com",               newTab:true, badge:"↗ New Tab",desc:"Cloud storage, docs and files"},
  {id:"canva",     name:"Canva",        domain:"canva.com",           icon:"🎨",cat:"Tools", url:"https://www.canva.com",                  newTab:true, badge:"↗ New Tab",desc:"Design anything, publish anywhere"},
  {id:"replit",    name:"Replit",       domain:"replit.com",          icon:"💻",cat:"Tools", url:"https://replit.com",                     newTab:true, badge:"↗ New Tab",desc:"Code, build and ship from your browser"},
  {id:"chatgpt",   name:"ChatGPT",      domain:"openai.com",          icon:"🤖",cat:"Tools", url:"https://chatgpt.com",                    newTab:true, badge:"↗ New Tab",desc:"AI assistant for answers, writing and ideas"},
  {id:"gmaps",     name:"Google Maps",  domain:"google.com",          icon:"🗺️",cat:"Tools", url:"https://maps.google.com",                newTab:true, badge:"↗ New Tab",desc:"Explore, search and navigate the world"},
  {id:"photopea",  name:"Photopea",     domain:"photopea.com",        icon:"🖼️",cat:"Tools", url:"https://www.photopea.com",               newTab:false,badge:"✓ In-App",desc:"Advanced photo editor in your browser"},
  {id:"instagram", name:"Instagram",    domain:"instagram.com",       icon:"📷",cat:"Social",url:"https://www.instagram.com",              newTab:true, badge:"↗ New Tab",desc:"Photos, reels and stories from friends"},
  {id:"tiktok",    name:"TikTok",       domain:"tiktok.com",          icon:"🎵",cat:"Social",url:"https://www.tiktok.com",                 newTab:true, badge:"↗ New Tab",desc:"Short-form videos made for you"},
  {id:"facebook",  name:"Facebook",     domain:"facebook.com",        icon:"👍",cat:"Social",url:"https://www.facebook.com",               newTab:true, badge:"↗ New Tab",desc:"Connect with friends and communities"},
  {id:"whatsapp",  name:"WhatsApp",     domain:"whatsapp.com",        icon:"💬",cat:"Social",url:"https://web.whatsapp.com",               newTab:true, badge:"↗ New Tab",desc:"Simple, reliable, private messaging"},
  {id:"pinterest", name:"Pinterest",    domain:"pinterest.com",       icon:"📌",cat:"Social",url:"https://www.pinterest.com",              newTab:true, badge:"↗ New Tab",desc:"Find ideas and inspiration"},
  {id:"linkedin",  name:"LinkedIn",     domain:"linkedin.com",        icon:"💼",cat:"Social",url:"https://www.linkedin.com",               newTab:true, badge:"↗ New Tab",desc:"Your professional network"},
  {id:"bbc",       name:"BBC News",     domain:"bbc.com",             icon:"📰",cat:"News",  url:"https://www.bbc.com/news",               newTab:false,badge:"✓ In-App",desc:"Breaking news from the UK and around the world"},
  {id:"cnn",       name:"CNN",          domain:"cnn.com",             icon:"📺",cat:"News",  url:"https://www.cnn.com",                    newTab:true, badge:"↗ New Tab",desc:"Breaking news, latest updates and analysis"},
  {id:"theverge",  name:"The Verge",    domain:"theverge.com",        icon:"🔺",cat:"News",  url:"https://www.theverge.com",               newTab:false,badge:"✓ In-App",desc:"Technology, science and culture"},
  {id:"medium",    name:"Medium",       domain:"medium.com",          icon:"✍️",cat:"News",  url:"https://medium.com",                     newTab:false,badge:"✓ In-App",desc:"Stories and ideas worth reading"},
  {id:"espn",      name:"ESPN",         domain:"espn.com",            icon:"🏈",cat:"News",  url:"https://www.espn.com",                   newTab:true, badge:"↗ New Tab",desc:"Live scores, sports news and highlights"},
];

export const STORE_CATS = ["All","Games","Media","Tools","Social","News"];

// v8.4 Store revamp: per-app presentation metadata that powers the new
// "real app store" UI — a brand accent color (drives the icon monogram
// tile + the detail-page hero gradient), the publisher/developer name, and
// a short marketing tagline shown under the app name. Keyed by catalog id.
// Apps without a custom-drawn brand SVG (see StoreBrandIcon) fall back to a
// monogram tile tinted with `accent`.
export const STORE_META = {
  roblox:    { developer:"Roblox Corporation",    tagline:"Reimagine the way people play together", accent:"#0084ff" },
  xbox:      { developer:"Microsoft",             tagline:"Stream Xbox Game Pass in your browser",   accent:"#107c10" },
  steam:     { developer:"Valve",                 tagline:"The ultimate destination for PC games",   accent:"#1b2838" },
  ps:        { developer:"Sony Interactive",      tagline:"Play PlayStation in the cloud",           accent:"#0070d1" },
  itchio:    { developer:"itch corp",             tagline:"Indie games & creative tools",            accent:"#fa5c5c" },
  poki:      { developer:"Poki",                  tagline:"Play free games, instantly",              accent:"#6c4cf1" },
  crazygames:{ developer:"CrazyGames",            tagline:"Hundreds of free browser games",          accent:"#7c3aed" },
  youtube:   { developer:"Google",                tagline:"Watch, share and create videos",          accent:"#ff0000" },
  spotify:   { developer:"Spotify AB",            tagline:"Music and podcasts for everyone",         accent:"#1db954" },
  twitch:    { developer:"Amazon",                tagline:"Live streaming for gamers",               accent:"#9146ff" },
  soundcloud:{ developer:"SoundCloud",            tagline:"Hear the world's sounds",                 accent:"#ff5500" },
  github:    { developer:"Microsoft",             tagline:"Where the world builds software",         accent:"#1f2328" },
  figma:     { developer:"Figma, Inc.",           tagline:"Design and prototype, together",          accent:"#2c2c2c" },
  notion:    { developer:"Notion Labs",           tagline:"Your connected workspace",                accent:"#2f3437" },
  codepen:   { developer:"CodePen",               tagline:"Build, test and discover front-end code", accent:"#1e1f26" },
  discord:   { developer:"Discord Inc.",          tagline:"Talk, chat, and hang out",                accent:"#5865f2" },
  reddit:    { developer:"Reddit Inc.",           tagline:"Dive into anything",                      accent:"#ff4500" },
  twitter:   { developer:"X Corp.",               tagline:"What's happening, right now",             accent:"#0f1419" },
  hn:        { developer:"Y Combinator",          tagline:"News for hackers and founders",           accent:"#ff6600" },
  wiki:      { developer:"Wikimedia Foundation",  tagline:"The free encyclopedia",                   accent:"#101418" },
  arxiv:     { developer:"Cornell University",    tagline:"Open-access scientific research",         accent:"#b31b1b" },
  // v8.4 expanded catalog
  epicgames: { developer:"Epic Games",            tagline:"Games, store and Unreal Engine",          accent:"#2a2a2a" },
  coolmath:  { developer:"Coolmath",              tagline:"Where logic and thinking meets fun",      accent:"#ff7a00" },
  miniclip:  { developer:"Miniclip",              tagline:"Play the best free online games",         accent:"#e4002b" },
  kongregate:{ developer:"Kongregate",            tagline:"Thousands of free games",                 accent:"#5b9a1f" },
  newgrounds:{ developer:"Newgrounds",            tagline:"Everything, by everyone",                 accent:"#fa9000" },
  lichess:   { developer:"Lichess",               tagline:"Free, open-source chess",                 accent:"#3a3a3a" },
  netflix:   { developer:"Netflix",               tagline:"Watch TV shows and movies",               accent:"#e50914" },
  disney:    { developer:"Disney",                tagline:"The worlds you love, all in one place",   accent:"#1a3fae" },
  primevideo:{ developer:"Amazon",                tagline:"Movies and TV, with Prime",               accent:"#00a8e1" },
  applemusic:{ developer:"Apple",                 tagline:"Over 100 million songs",                  accent:"#fa2d48" },
  vimeo:     { developer:"Vimeo",                 tagline:"High-quality video for creators",         accent:"#1ab7ea" },
  hulu:      { developer:"Disney",                tagline:"Stream TV, movies and originals",         accent:"#1ce783" },
  gdrive:    { developer:"Google",                tagline:"Cloud storage for your files",            accent:"#1fa463" },
  canva:     { developer:"Canva",                 tagline:"Design anything, publish anywhere",       accent:"#00c4cc" },
  replit:    { developer:"Replit",                tagline:"Code from your browser",                  accent:"#f26207" },
  chatgpt:   { developer:"OpenAI",                tagline:"Answers, writing and ideas",              accent:"#10a37f" },
  gmaps:     { developer:"Google",                tagline:"Explore and navigate the world",          accent:"#1a73e8" },
  photopea:  { developer:"Photopea",              tagline:"A photo editor in your browser",          accent:"#2451b7" },
  instagram: { developer:"Meta",                  tagline:"Photos, reels and stories",               accent:"#d6249f" },
  tiktok:    { developer:"TikTok",                tagline:"Short videos made for you",               accent:"#010101" },
  facebook:  { developer:"Meta",                  tagline:"Connect with friends and the world",      accent:"#1877f2" },
  whatsapp:  { developer:"Meta",                  tagline:"Simple, reliable messaging",              accent:"#25d366" },
  pinterest: { developer:"Pinterest",             tagline:"Find ideas and inspiration",              accent:"#e60023" },
  linkedin:  { developer:"Microsoft",             tagline:"Your professional network",               accent:"#0a66c2" },
  bbc:       { developer:"BBC",                    tagline:"Breaking news, UK and world",             accent:"#bb1919" },
  cnn:       { developer:"CNN",                    tagline:"Breaking news and analysis",              accent:"#cc0000" },
  theverge:  { developer:"Vox Media",             tagline:"Tech, science and culture",               accent:"#5200ff" },
  medium:    { developer:"Medium",                tagline:"Stories and ideas worth reading",         accent:"#1a1a1a" },
  espn:      { developer:"ESPN",                  tagline:"Live scores, news and highlights",        accent:"#d50a0a" },
};

// Hand-picked apps for the Store home "Featured" hero carousel. Order matters
// — these render left-to-right as large banner cards at the top of Home.
export const STORE_FEATURED = ["roblox","spotify","netflix","youtube","instagram","discord"];

export const BOOT_MSGS = [
  "NOVA OS v" + NOVA_VERSION + " — Nova Systems",
  "Initializing kernel... OK",
  "Loading hardware abstraction layer... OK",
  "Mounting filesystems... OK",
  "Starting widget engine... OK",
  "Initializing Nova Store... OK",
  "Loading user environment... OK",
  "System ready.",
];

export const ACCENT_PRESETS = ["#4f9eff","#ff6b6b","#4cef90","#ffcc44","#cc44ff","#ff8c44","#44ddcc","#ff44aa"];

export const BOOKMARKS = [
  {label:"Hacker News", url:"https://news.ycombinator.com"},
  {label:"Wikipedia",   url:"https://en.m.wikipedia.org"},
  {label:"Archive.org", url:"https://archive.org"},
  {label:"itch.io",     url:"https://itch.io"},
];

export const PAINT_COLORS = ["#fff","#000","#ff4444","#ff8800","#ffdd00","#44dd44","#00ccff","#4466ff","#cc44ff","#ff44aa","#8b4513","#888"];

// Available wallpapers + their preview gradients for the Settings picker.
// SVG-based wallpapers (mesh, aurora, nova, bliss) have their own components
// in src/ui/wallpapers.jsx; gradient-only ones (everything else) render
// directly via the wp.grad style.
//
// Mesh is first — it's the system default. v6.2 added Ocean, Sunset,
// Cyberpunk, and Zen to the lineup.
//
// Each wallpaper also carries a `semitones` value that shifts the system
// sound palette up or down. The default (mesh) is 0; positive values brighten
// the chime tones, negative values darken them. See src/lib/audio.js.
export const WALLPAPERS = {
  // v8.5: "Auto" is dynamic — the Wallpaper component swaps the real wallpaper
  // by time of day (see autoWallpaperId in wallpapers.jsx). Listed here so it
  // shows as a pickable swatch; it has no `grad`, only a preview gradient.
  auto:     {name:"Auto",      semitones: 0,  preview:"linear-gradient(90deg,#0b1026 0%,#1d4ed8 26%,#f59e0b 52%,#7c3aed 76%,#0b1026 100%)"},
  mesh:     {name:"Mesh",      semitones: 0,  preview:"radial-gradient(ellipse at 18% 22%,#6366f1 0%,transparent 45%),radial-gradient(ellipse at 82% 18%,#ec4899 0%,transparent 40%),radial-gradient(ellipse at 60% 85%,#06b6d4 0%,transparent 45%),linear-gradient(135deg,#0a0a14,#050510)"},
  // v10.0 — Supernova Edition signature wallpapers (SVG-backed; see
  // wallpapers.jsx). Supernova: a radiant exploding-star burst. Nebula: a
  // calm, spacious deep-space cloud companion. Both clean + professional.
  supernova:{name:"Supernova", semitones: 7,  preview:"radial-gradient(circle at 50% 44%,#eaf6ff 0%,#a5e8ff 12%,#22d3ee 26%,#38bdf8 42%,#2563eb 60%,#1e3a8a 78%,#03070f 100%)"},
  nebula:   {name:"Nebula",    semitones:-3,  preview:"radial-gradient(ellipse at 28% 30%,#2dd4bf 0%,transparent 46%),radial-gradient(ellipse at 76% 34%,#6366f1 0%,transparent 46%),radial-gradient(ellipse at 54% 82%,#c026d3 0%,transparent 48%),radial-gradient(ellipse at 86% 78%,#fb7185 0%,transparent 40%),linear-gradient(135deg,#07071a,#050510)"},
  // v8.0 additions — five new wallpapers designed for the refreshed UI.
  // Prism is SVG-backed (renders the holographic shimmer cleanly at any size);
  // the others are pure CSS gradients so they're zero-cost to render. Each
  // got a hand-picked `semitones` transpose so the system chime fits the mood.
  //
  // Halcyon: mesh-grade multi-blob wallpaper in a warmer, more sophisticated
  // palette than Mesh itself (coral / indigo / mint / amber on a deep
  // purple-charcoal base). Same restrained design philosophy as Mesh —
  // four soft color fields, heavy blur, vignette — but a clearly distinct
  // mood. Designed as a "premium dark" companion to Mesh's "vibrant dark".
  halcyon:  {name:"Halcyon",   semitones: 2,  preview:"radial-gradient(ellipse at 22% 25%,#fb7185 0%,transparent 50%),radial-gradient(ellipse at 78% 28%,#818cf8 0%,transparent 50%),radial-gradient(ellipse at 30% 82%,#5eead4 0%,transparent 50%),radial-gradient(ellipse at 75% 80%,#fbbf24 0%,transparent 45%),linear-gradient(135deg,#0c0a1a,#08071a)"},
  // Cascade: a macOS-Big-Sur-style wallpaper made of flowing curved ridges
  // stacked over a sky, recolored to Mesh's exact palette in Mesh's exact
  // order — indigo sky, pink/cyan/purple/amber ridges from back to front.
  // Each layer is a vertical gradient capped at Mesh's saturated hex with
  // a deeper matching base, so the ridges feel warm and dim like Mesh,
  // not bright/pastel like the earlier attempt.
  cascade:  {name:"Cascade",   semitones: 4,  preview:"linear-gradient(180deg,#312e81 0%,#312e81 35%,#be185d 38%,#500724 48%,#0e7490 53%,#083344 63%,#7c3aed 68%,#3b0764 78%,#d97706 83%,#7c2d12 100%)"},
  // Iris: a Windows-11-Bloom-style wallpaper — six translucent multi-color
  // glass petals radiating from the center on a tinted indigo backdrop.
  // Heavy blur gives the petals a glassy, refractive feel; a soft white
  // center glow sells the "light passing through prism" effect.
  iris:     {name:"Iris",      semitones: 1,  preview:"radial-gradient(circle at 50% 50%,#a855f7 0%,#6366f1 22%,#312e81 50%,#0c0a2b 80%,#020010 100%)"},
  // Ember: a Mac-Ventura-style wallpaper — layered curved petal shapes
  // flowing through amber → orange → red → magenta → purple. Captures the
  // warm/cool "golden hour into twilight" feel without copying any single
  // reference wallpaper directly.
  ember:    {name:"Ember",     semitones:-1,  preview:"linear-gradient(155deg,#fde68a 0%,#f59e0b 18%,#ea580c 35%,#be185d 60%,#7c3aed 82%,#1e1b4b 100%)"},
  prism:    {name:"Prism",     semitones: 6,  preview:"linear-gradient(135deg,#ff6b9d 0%,#a855f7 25%,#3b82f6 50%,#06b6d4 75%,#4cef90 100%)"},
  glass:    {name:"Glass",     semitones: 4,  preview:"radial-gradient(ellipse at 30% 25%,rgba(173,216,255,0.7) 0%,transparent 45%),radial-gradient(ellipse at 75% 80%,rgba(125,206,232,0.55) 0%,transparent 50%),linear-gradient(135deg,#1a3450 0%,#0a1c30 100%)",  grad:"radial-gradient(ellipse at 25% 22%,rgba(180,220,255,0.32) 0%,transparent 55%),radial-gradient(ellipse at 78% 75%,rgba(120,180,220,0.28) 0%,transparent 60%),radial-gradient(ellipse at 55% 50%,rgba(200,230,250,0.14) 0%,transparent 70%),linear-gradient(140deg,#142a44 0%,#0d1f33 45%,#081424 100%)"},
  solar:    {name:"Solar",     semitones:-2,  preview:"radial-gradient(ellipse at 50% 100%,#ffd089 0%,#ff7e3f 22%,#c02948 55%,#3a0d3a 90%)", grad:"radial-gradient(ellipse at 50% 110%,#ffe4a8 0%,#ffb05c 14%,#ff7038 28%,#d63149 50%,#7a1845 72%,#2a0826 92%,#0d0314 100%)"},
  // Tide (replaces Mono in v8.0): a Big-Sur-style flowing-ridge wallpaper
  // companion to Cascade, but rendered entirely in a blue→purple palette.
  // Sky-blue at the top, deeper indigo at the horizon, then four ridges
  // shifting from light blue (back) to deep violet (front) — the same
  // composition as Cascade but in a single cool color family.
  tide:     {name:"Tide",      semitones:-2,  preview:"linear-gradient(180deg,#1e3a8a 0%,#1e3a8a 35%,#3b82f6 38%,#1e3a8a 48%,#2563eb 53%,#172554 63%,#6366f1 68%,#312e81 78%,#7c3aed 83%,#3b0764 100%)"},
  velvet:   {name:"Velvet",    semitones:-1,  preview:"radial-gradient(ellipse at 30% 25%,#7c2d4a 0%,#3d0e2a 38%,#1a0413 75%,#08020a 100%)", grad:"radial-gradient(ellipse at 32% 22%,#a13a5e 0%,#7c2d4a 14%,#4d1232 32%,#2a0820 55%,#13030f 80%,#06010a 100%),radial-gradient(ellipse at 78% 85%,rgba(180,80,140,0.18) 0%,transparent 50%)"},
  // v7.0 additions
  lumen:    {name:"Lumen",     semitones:-1,  preview:"radial-gradient(circle at 50% 60%,#ffd89e 0%,#c97a3f 18%,#3a1a4a 50%,#0a0418 80%)", grad:"radial-gradient(circle at 50% 60%,#fff2d4 0%,#ffd89e 12%,#e0905a 25%,#7a2e5c 50%,#1a0830 75%,#050211 100%)"},
  drift:    {name:"Drift",     semitones: 8,  preview:"radial-gradient(ellipse at 20% 30%,#fbcfe8 0%,transparent 50%),radial-gradient(ellipse at 75% 70%,#c4b5fd 0%,transparent 55%),radial-gradient(ellipse at 50% 50%,#a7f3d0 0%,transparent 60%),linear-gradient(135deg,#fdf2f8,#ede9fe,#ecfdf5)", grad:"radial-gradient(ellipse at 18% 28%,#fbcfe8 0%,transparent 55%),radial-gradient(ellipse at 78% 70%,#c4b5fd 0%,transparent 60%),radial-gradient(ellipse at 50% 50%,#a7f3d0 0%,transparent 65%),radial-gradient(ellipse at 90% 15%,#fed7aa 0%,transparent 45%),linear-gradient(135deg,#fdf2f8 0%,#ede9fe 50%,#ecfdf5 100%)"},
  halo:     {name:"Halo",      semitones: 2,  preview:"radial-gradient(circle at 50% 50%,#7c3aed 0%,#3730a3 22%,#1e1b4b 45%,#0a0a1f 75%)", grad:"radial-gradient(circle at 50% 50%,#a78bfa 0%,#7c3aed 12%,#4c1d95 28%,#1e1b4b 48%,#0a0a1f 75%,#020010 100%),radial-gradient(circle at 50% 50%,transparent 30%,rgba(167,139,250,0.08) 40%,transparent 50%,rgba(167,139,250,0.06) 65%,transparent 75%)"},
  aurora:   {name:"Aurora",    semitones: 5,  preview:"linear-gradient(180deg,#0a0218 0%,#3b1d6a 35%,#10b981 60%,#0a0218 100%),radial-gradient(ellipse at 50% 90%,#a855f7 0%,transparent 50%)"},
  nova:     {name:"Nova",      semitones:-2,  preview:"radial-gradient(ellipse at 25% 20%,#0ea5e9 0%,transparent 55%),radial-gradient(ellipse at 80% 85%,#7c3aed 0%,transparent 50%),linear-gradient(135deg,#07080f,#0d0a1a)"},
  ocean:    {name:"Ocean",     semitones:-4,  preview:"radial-gradient(ellipse at 50% 20%,#42a5f5 0%,transparent 55%),linear-gradient(180deg,#031a2e 0%,#0a3a66 40%,#1565c0 100%)", grad:"radial-gradient(ellipse at 50% 25%,#42a5f5 0%,transparent 60%),radial-gradient(ellipse at 20% 90%,#00acc1 0%,transparent 45%),linear-gradient(180deg,#02101f 0%,#072b4d 35%,#0d3b66 65%,#1565c0 100%)"},
  sunset:   {name:"Sunset",    semitones: 4,  preview:"linear-gradient(180deg,#1a0033 0%,#4a148c 20%,#d84315 55%,#ff6f00 80%,#ffab40 100%)", grad:"radial-gradient(ellipse at 50% 95%,#ffab40 0%,transparent 50%),radial-gradient(ellipse at 80% 75%,#ff6f00 0%,transparent 45%),linear-gradient(180deg,#0d001f 0%,#3a0a5c 25%,#7b1fa2 50%,#d84315 75%,#ff7043 100%)"},
  cyber:    {name:"Cyberpunk", semitones: 3,  preview:"radial-gradient(ellipse at 85% 15%,#ec4899 0%,transparent 45%),radial-gradient(ellipse at 15% 85%,#06b6d4 0%,transparent 40%),linear-gradient(135deg,#0d0221 0%,#3b0764 50%,#1a0033 100%)", grad:"radial-gradient(ellipse at 80% 20%,#ec4899 0%,transparent 50%),radial-gradient(ellipse at 15% 80%,#06b6d4 0%,transparent 50%),radial-gradient(ellipse at 50% 50%,#7c1fa0 0%,transparent 60%),linear-gradient(135deg,#0d0221 0%,#1f0540 50%,#0a0118 100%)"},
  zen:      {name:"Zen",       semitones:-7,  preview:"linear-gradient(160deg,#fef9e7 0%,#f5e6d3 50%,#d4a574 100%)", grad:"radial-gradient(ellipse at 30% 30%,#fffef5 0%,transparent 55%),linear-gradient(160deg,#fef9e7 0%,#f5e6d3 45%,#e0c8a0 80%,#c8a060 100%)"},
  bliss:    {name:"Bliss",     semitones: 7,  preview:"linear-gradient(180deg,#4a9fd1 44%,#6ec82e 44%)"},
  night:    {name:"Night",     semitones:-5,  preview:"radial-gradient(#1a0f40,#03020d)",  grad:"radial-gradient(ellipse at 50% 0%,#1a0f40,#03020d)"},
  sakura:   {name:"Sakura",    semitones: 9,  preview:"linear-gradient(155deg,#ffd6e7,#ff8fa3)", grad:"linear-gradient(155deg,#ffd6e7,#ffb3c6,#ff8fa3)"},
  forest:   {name:"Forest",    semitones:-3,  preview:"radial-gradient(#1a5010,#051204)",  grad:"radial-gradient(ellipse at 50% 100%,#1a5010,#051204)"},
  slate:    {name:"Slate",     semitones: 1,  preview:"linear-gradient(135deg,#1e2235,#0f1219)", grad:"linear-gradient(135deg,#1e2235,#0f1219)"},
  custom:   {name:"Custom",    semitones: 0,  preview:"conic-gradient(#888,#555)"},
};

// WMO weather codes (used by Open-Meteo) → emoji glyphs for the weather widget.
// Full descriptions live in src/lib/weather.js.
export const WMO = {0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",51:"🌦️",53:"🌦️",55:"🌧️",61:"🌧️",63:"🌧️",65:"🌧️",71:"🌨️",73:"🌨️",75:"❄️",80:"🌦️",81:"🌧️",82:"⛈️",95:"⛈️",99:"⛈️"};

// App ids that have a custom SVG in NovaSvgIcon. Anything not in here gets
// the app.icon emoji as a fallback via AppIconDisplay.
export const HAS_SVG_ICON = new Set([
  "notes","tasks","files","paint","browser","snake","2048",
  "store","terminal","settings","profile","chat",
  // 5.1 apps
  "calculator","clock","calendar","music","pdf","atmos",
  "minesweeper","wordle","tetris",
  // 5.2
  "novaai",
  // v8.0 round-3: icons for the v7.4 games + new Photos app
  "tictactoe","pong","flappy","invaders","pacman","chess","photos",
]);

// Window resize handle definitions (thin for mouse, fat for touch).
export const HANDLE_DEFS_MOUSE = [
  {id:"n",s:{top:0,left:8,right:8,height:5,cursor:"n-resize"}},{id:"s",s:{bottom:0,left:8,right:8,height:5,cursor:"s-resize"}},
  {id:"w",s:{top:8,left:0,bottom:8,width:5,cursor:"w-resize"}},{id:"e",s:{top:8,right:0,bottom:8,width:5,cursor:"e-resize"}},
  {id:"nw",s:{top:0,left:0,width:12,height:12,cursor:"nw-resize"}},{id:"ne",s:{top:0,right:0,width:12,height:12,cursor:"ne-resize"}},
  {id:"sw",s:{bottom:0,left:0,width:12,height:12,cursor:"sw-resize"}},{id:"se",s:{bottom:0,right:0,width:12,height:12,cursor:"se-resize"}},
];
export const HANDLE_DEFS_TOUCH = [
  {id:"n",s:{top:0,left:14,right:14,height:14,cursor:"n-resize"}},{id:"s",s:{bottom:0,left:14,right:14,height:14,cursor:"s-resize"}},
  {id:"w",s:{top:14,left:0,bottom:14,width:14,cursor:"w-resize"}},{id:"e",s:{top:14,right:0,bottom:14,width:14,cursor:"e-resize"}},
  {id:"nw",s:{top:0,left:0,width:22,height:22,cursor:"nw-resize"}},{id:"ne",s:{top:0,right:0,width:22,height:22,cursor:"ne-resize"}},
  {id:"sw",s:{bottom:0,left:0,width:22,height:22,cursor:"sw-resize"}},{id:"se",s:{bottom:0,right:0,width:22,height:22,cursor:"se-resize"}},
];

// Widget shell resize handles (same shape, different ids/zIndex).
export const WGT_HANDLES_MOUSE = [
  {id:"n", s:{top:0,left:8,right:8,height:5,cursor:"n-resize"}},
  {id:"s", s:{bottom:0,left:8,right:8,height:5,cursor:"s-resize"}},
  {id:"w", s:{top:8,left:0,bottom:8,width:5,cursor:"w-resize"}},
  {id:"e", s:{top:8,right:0,bottom:8,width:5,cursor:"e-resize"}},
  {id:"nw",s:{top:0,left:0,width:12,height:12,cursor:"nw-resize"}},
  {id:"ne",s:{top:0,right:0,width:12,height:12,cursor:"ne-resize"}},
  {id:"sw",s:{bottom:0,left:0,width:12,height:12,cursor:"sw-resize"}},
  {id:"se",s:{bottom:0,right:0,width:12,height:12,cursor:"se-resize"}},
];
export const WGT_HANDLES_TOUCH = [
  {id:"n", s:{top:0,left:14,right:14,height:14,cursor:"n-resize"}},
  {id:"s", s:{bottom:0,left:14,right:14,height:14,cursor:"s-resize"}},
  {id:"w", s:{top:14,left:0,bottom:14,width:14,cursor:"w-resize"}},
  {id:"e", s:{top:14,right:0,bottom:14,width:14,cursor:"e-resize"}},
  {id:"nw",s:{top:0,left:0,width:22,height:22,cursor:"nw-resize"}},
  {id:"ne",s:{top:0,right:0,width:22,height:22,cursor:"ne-resize"}},
  {id:"sw",s:{bottom:0,left:0,width:22,height:22,cursor:"sw-resize"}},
  {id:"se",s:{bottom:0,right:0,width:22,height:22,cursor:"se-resize"}},
];
