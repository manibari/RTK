import type { IGraphRepository } from "./types/repository.js";
import type { CharacterNode, RelationshipEdge, PlaceNode, RoadEdge } from "./types/graph.js";

const S0 = { leadership: 0, tactics: 0, commerce: 0, espionage: 0 };

const characters: CharacterNode[] = [
  // bornTick: negative value = born before game start. Age = (currentTick - bornTick) / 16 years
  // Shu faction — centered on Chengdu
  { id: "liu_bei", name: "劉備", biography: "漢室宗親，以仁義聞名天下，三顧茅廬得臥龍，終建蜀漢基業。", avatarUrl: "/avatars/liu_bei.svg", traits: ["benevolent", "ambitious", "charismatic"], cityId: "chengdu", military: 1, intelligence: 1, charm: 5, skills: { ...S0, leadership: 3 }, bornTick: -480 },
  { id: "guan_yu", name: "關羽", biography: "義薄雲天，溫酒斬華雄，千里走單騎，被尊為武聖。", avatarUrl: "/avatars/guan_yu.svg", traits: ["loyal", "brave", "proud"], cityId: "chengdu", military: 4, intelligence: 1, charm: 0, skills: { ...S0, tactics: 2 }, bornTick: -512 },
  { id: "zhang_fei", name: "張飛", biography: "燕人張翼德，長坂坡一聲喝退曹軍百萬，勇冠三軍。", avatarUrl: "/avatars/zhang_fei.svg", traits: ["brave", "impulsive", "loyal"], cityId: "hanzhong", military: 4, intelligence: 0, charm: 1, skills: { ...S0, tactics: 1 }, bornTick: -416 },
  { id: "zhuge_liang", name: "諸葛亮", biography: "臥龍先生，隆中對定三分天下，鞠躬盡瘁死而後已。", avatarUrl: "/avatars/zhuge_liang.svg", traits: ["wise", "cautious", "strategic"], cityId: "xinye", military: 1, intelligence: 5, charm: 0, skills: { ...S0, espionage: 2, commerce: 1 }, bornTick: -352 },
  { id: "zhao_yun", name: "趙雲", biography: "常山趙子龍，長坂坡七進七出救幼主，一身是膽。", avatarUrl: "/avatars/zhao_yun.svg", traits: ["loyal", "brave", "humble"], cityId: "chengdu", military: 3, intelligence: 1, charm: 2, skills: { ...S0, tactics: 2 }, bornTick: -400 },
  { id: "wei_yan", name: "魏延", biography: "蜀漢猛將，鎮守漢中多年，善奇謀，性格桀驁不馴。", avatarUrl: "/avatars/wei_yan.svg", traits: ["brave", "ambitious", "impulsive"], cityId: "hanzhong", military: 4, intelligence: 1, charm: 0, skills: { ...S0, tactics: 2 }, bornTick: -400 },
  { id: "jiang_wei", name: "姜維", biography: "天水麒麟兒，諸葛亮欽點的接班人，九伐中原矢志不渝。", avatarUrl: "/avatars/jiang_wei.svg", traits: ["loyal", "strategic", "ambitious"], cityId: "chengdu", military: 3, intelligence: 3, charm: 1, skills: { ...S0, tactics: 2, leadership: 1 }, bornTick: -288 },
  { id: "fa_zheng", name: "法正", biography: "蜀漢謀主，獻計取益州，劉備最信賴的軍師之一。", avatarUrl: "/avatars/fa_zheng.svg", traits: ["cunning", "strategic", "ambitious"], cityId: "chengdu", military: 0, intelligence: 4, charm: 1, skills: { ...S0, espionage: 2, commerce: 1 }, bornTick: -384 },

  // Wei faction — centered on Luoyang
  { id: "cao_cao", name: "曹操", biography: "亂世之奸雄，治世之能臣。挾天子以令諸侯，統一北方。", avatarUrl: "/avatars/cao_cao.svg", traits: ["ambitious", "cunning", "charismatic"], cityId: "luoyang", military: 1, intelligence: 3, charm: 3, skills: { ...S0, leadership: 2, commerce: 1 }, bornTick: -576 },
  { id: "xu_huang", name: "徐晃", biography: "曹魏五子良將之一，治軍嚴謹，樊城之戰大破關羽。", avatarUrl: "/avatars/xu_huang.svg", traits: ["loyal", "brave", "cautious"], cityId: "xuchang", military: 3, intelligence: 2, charm: 1, skills: { ...S0, tactics: 2 }, bornTick: -448 },
  { id: "xiahou_dun", name: "夏侯惇", biography: "曹操族弟，獨眼將軍，拔矢啖睛的猛將，忠心耿耿。", avatarUrl: "/avatars/xiahou_dun.svg", traits: ["brave", "loyal", "proud"], cityId: "luoyang", military: 4, intelligence: 1, charm: 1, skills: { ...S0, tactics: 2, leadership: 1 }, bornTick: -512 },
  { id: "xiahou_yuan", name: "夏侯淵", biography: "曹魏名將，擅長急行軍，三日五百里，定軍山戰死。", avatarUrl: "/avatars/xiahou_yuan.svg", traits: ["brave", "impulsive", "ambitious"], cityId: "changan", military: 4, intelligence: 1, charm: 0, skills: { ...S0, tactics: 2 }, bornTick: -480 },
  { id: "dian_wei", name: "典韋", biography: "古之惡來，曹操貼身護衛，濮陽戰以一當十，壯烈殉主。", avatarUrl: "/avatars/dian_wei.svg", traits: ["brave", "loyal", "impulsive"], cityId: "luoyang", military: 5, intelligence: 0, charm: 0, skills: { ...S0, tactics: 1 }, bornTick: -480 },
  { id: "xun_yu", name: "荀彧", biography: "王佐之才，曹操首席謀臣，居中持重，運籌帷幄。", avatarUrl: "/avatars/xun_yu.svg", traits: ["wise", "loyal", "cautious"], cityId: "xuchang", military: 0, intelligence: 5, charm: 2, skills: { ...S0, commerce: 2, leadership: 1 }, bornTick: -448 },
  { id: "guo_jia", name: "郭嘉", biography: "鬼才軍師，算無遺策，官渡之戰獻十勝十敗論，英年早逝。", avatarUrl: "/avatars/guo_jia.svg", traits: ["wise", "cunning", "strategic"], cityId: "luoyang", military: 0, intelligence: 5, charm: 1, skills: { ...S0, espionage: 2, tactics: 1 }, bornTick: -416 },
  { id: "zhang_liao", name: "張遼", biography: "曹魏五子良將之首，逍遙津八百破十萬，威震江東。", avatarUrl: "/avatars/zhang_liao.svg", traits: ["brave", "strategic", "loyal"], cityId: "hefei", military: 4, intelligence: 2, charm: 1, skills: { ...S0, tactics: 3 }, bornTick: -448 },

  // Wu faction — centered on Jianye
  { id: "sun_quan", name: "孫權", biography: "紫髯碧眼，承父兄基業，善用人才，穩固江東霸業。", avatarUrl: "/avatars/sun_quan.svg", traits: ["cautious", "diplomatic", "ambitious"], cityId: "jianye", military: 1, intelligence: 3, charm: 3, skills: { ...S0, commerce: 2, leadership: 1 }, bornTick: -320 },
  { id: "zhou_yu", name: "周瑜", biography: "美周郎，赤壁大破曹軍，精通音律，文武雙全。", avatarUrl: "/avatars/zhou_yu.svg", traits: ["strategic", "proud", "ambitious"], cityId: "jianye", military: 2, intelligence: 3, charm: 0, skills: { ...S0, tactics: 2, espionage: 1 }, bornTick: -384 },
  { id: "gan_ning", name: "甘寧", biography: "錦帆賊出身，百騎劫曹營，孫權麾下水戰悍將。", avatarUrl: "/avatars/gan_ning.svg", traits: ["brave", "impulsive", "charismatic"], cityId: "jiangxia", military: 3, intelligence: 1, charm: 2, skills: { ...S0, tactics: 1, commerce: 1 }, bornTick: -400 },
  { id: "lu_su", name: "魯肅", biography: "東吳重臣，力主孫劉聯盟，單刀赴會維護外交大局。", avatarUrl: "/avatars/lu_su.svg", traits: ["wise", "diplomatic", "loyal"], cityId: "jianye", military: 0, intelligence: 4, charm: 3, skills: { ...S0, leadership: 2, commerce: 1 }, bornTick: -416 },
  { id: "huang_gai", name: "黃蓋", biography: "三朝元老，赤壁之戰獻苦肉計，火燒曹營立下大功。", avatarUrl: "/avatars/huang_gai.svg", traits: ["loyal", "brave", "cunning"], cityId: "jiangxia", military: 3, intelligence: 2, charm: 1, skills: { ...S0, tactics: 1, espionage: 1 }, bornTick: -576 },
  { id: "taishi_ci", name: "太史慈", biography: "東萊猛將，弓馬嫻熟，與孫策神亭酣戰後歸順東吳。", avatarUrl: "/avatars/taishi_ci.svg", traits: ["brave", "loyal", "proud"], cityId: "kuaiji", military: 4, intelligence: 1, charm: 1, skills: { ...S0, tactics: 2 }, bornTick: -448 },
  { id: "lv_meng", name: "呂蒙", biography: "吳下阿蒙，士別三日刮目相看，白衣渡江奪取荊州。", avatarUrl: "/avatars/lv_meng.svg", traits: ["strategic", "cunning", "ambitious"], cityId: "jianye", military: 2, intelligence: 3, charm: 1, skills: { ...S0, tactics: 2, espionage: 1 }, bornTick: -384 },

  // Lu Bu faction — centered on Xiapi
  { id: "lu_bu", name: "呂布", biography: "人中呂布馬中赤兔，天下無雙的飛將軍，三姓家奴。", avatarUrl: "/avatars/lu_bu.svg", traits: ["brave", "treacherous", "impulsive"], cityId: "xiapi", military: 4, intelligence: 0, charm: 0, skills: { ...S0, tactics: 3 }, bornTick: -560 },
  { id: "diao_chan", name: "貂蟬", biography: "四大美人之一，連環計離間董卓與呂布，以美色改寫歷史。", avatarUrl: "/avatars/diao_chan.svg", traits: ["charismatic", "cunning", "diplomatic"], cityId: "xiapi", military: 0, intelligence: 3, charm: 5, skills: { ...S0, espionage: 2, leadership: 1 }, bornTick: -320 },

  // Neutral (unaffiliated) characters
  { id: "xu_shu", name: "徐庶", biography: "本為劉備謀士，因母被挾而入曹營，一言不發終身不獻一策。", avatarUrl: "/avatars/xu_shu.svg", traits: ["wise", "loyal", "humble"], cityId: "changsha", military: 1, intelligence: 4, charm: 2, skills: { ...S0, tactics: 1, espionage: 1 }, bornTick: -448 },
  { id: "pang_tong", name: "龐統", biography: "鳳雛先生，與臥龍齊名，獻連環計助赤壁之勝，落鳳坡殞命。", avatarUrl: "/avatars/pang_tong.svg", traits: ["wise", "strategic", "cunning"], cityId: "nanman", military: 0, intelligence: 5, charm: 1, skills: { ...S0, tactics: 2, commerce: 1 }, bornTick: -416 },
  { id: "huang_zhong", name: "黃忠", biography: "老當益壯，定軍山斬夏侯淵，百步穿楊的神弓手。", avatarUrl: "/avatars/huang_zhong.svg", traits: ["brave", "loyal", "proud"], cityId: "changsha", military: 5, intelligence: 0, charm: 1, skills: { ...S0, tactics: 3 }, bornTick: -800 },
  { id: "ma_chao", name: "馬超", biography: "西涼錦馬超，為父報仇割據一方，後歸順劉備封五虎上將。", avatarUrl: "/avatars/ma_chao.svg", traits: ["brave", "impulsive", "ambitious"], cityId: "tianshui", military: 4, intelligence: 1, charm: 2, skills: { ...S0, tactics: 2, leadership: 1 }, bornTick: -352 },
  { id: "sima_yi", name: "司馬懿", biography: "鷹視狼顧，忍辱負重數十年，終為司馬家奪取天下埋下伏筆。", avatarUrl: "/avatars/sima_yi.svg", traits: ["cunning", "cautious", "ambitious"], cityId: "ye", military: 1, intelligence: 5, charm: 2, skills: { ...S0, espionage: 3, leadership: 1 }, bornTick: -352 },
  { id: "yan_liang", name: "顏良", biography: "河北名將，袁紹麾下首席猛將，白馬之戰被關羽一刀斬落。", avatarUrl: "/avatars/yan_liang.svg", traits: ["brave", "proud", "loyal"], cityId: "jinan", military: 4, intelligence: 0, charm: 1, skills: { ...S0, tactics: 2 }, bornTick: -480 },
  { id: "wen_chou", name: "文醜", biography: "河北四庭柱之一，與顏良齊名，延津之戰敗亡。", avatarUrl: "/avatars/wen_chou.svg", traits: ["brave", "impulsive", "proud"], cityId: "jinan", military: 4, intelligence: 0, charm: 0, skills: { ...S0, tactics: 1 }, bornTick: -480 },
  { id: "zhang_jiao", name: "張角", biography: "太平道教主，黃巾起義領袖，蒼天已死黃天當立，揭開三國序幕。", avatarUrl: "/avatars/zhang_jiao.svg", traits: ["charismatic", "cunning", "ambitious"], cityId: "pingyuan", military: 1, intelligence: 3, charm: 4, skills: { ...S0, leadership: 2, espionage: 1 }, bornTick: -576 },
  { id: "hua_tuo", name: "華佗", biography: "神醫華佗，發明麻沸散，欲為曹操開顱治病，被疑而殺。", avatarUrl: "/avatars/hua_tuo.svg", traits: ["wise", "humble", "cautious"], cityId: "lujiang", military: 0, intelligence: 4, charm: 3, skills: { ...S0, commerce: 2 }, bornTick: -576 },
  { id: "yuan_shao", name: "袁紹", biography: "四世三公，北方霸主，官渡之戰敗於曹操，從此一蹶不振。", avatarUrl: "/avatars/yuan_shao.svg", traits: ["ambitious", "proud", "diplomatic"], cityId: "ye", military: 1, intelligence: 2, charm: 3, skills: { ...S0, leadership: 2, commerce: 1 }, bornTick: -544 },

  // ── Additional neutral characters ──
  { id: "lu_xun", name: "陸遜", biography: "東吳後期大都督，夷陵之戰火燒連營七百里，大破劉備。", avatarUrl: "/avatars/lu_xun.svg", traits: ["strategic", "cautious", "wise"], cityId: "hangzhou", military: 2, intelligence: 4, charm: 2, skills: { ...S0, tactics: 2, leadership: 2 }, bornTick: -320 },
  { id: "cao_ren", name: "曹仁", biography: "曹操族弟，善守城池，樊城之戰力拒關羽，魏之屏障。", avatarUrl: "/avatars/cao_ren.svg", traits: ["brave", "loyal", "cautious"], cityId: "wan", military: 3, intelligence: 2, charm: 1, skills: { ...S0, tactics: 2, leadership: 2 }, bornTick: -480 },
  { id: "zhang_he", name: "張郃", biography: "五子良將之一，善巧變，以精於山地戰聞名。", avatarUrl: "/avatars/zhang_he.svg", traits: ["strategic", "brave", "cautious"], cityId: "jinyang", military: 3, intelligence: 2, charm: 1, skills: { ...S0, tactics: 2, leadership: 1 }, bornTick: -448 },
  { id: "xu_chu", name: "許褚", biography: "虎侯，曹操貼身護衛，裸衣鬥馬超，力大無窮。", avatarUrl: "/avatars/xu_chu.svg", traits: ["brave", "loyal", "impulsive"], cityId: "pingyuan", military: 5, intelligence: 0, charm: 0, skills: { ...S0, tactics: 1 }, bornTick: -480 },
  { id: "sun_ce", name: "孫策", biography: "小霸王，以傳國玉璽借兵，橫掃江東六郡，英年早逝。", avatarUrl: "/avatars/sun_ce.svg", traits: ["brave", "ambitious", "charismatic"], cityId: "nanchang", military: 3, intelligence: 2, charm: 3, skills: { ...S0, tactics: 1, leadership: 2 }, bornTick: -384 },
  { id: "gongsun_zan", name: "公孫瓚", biography: "白馬將軍，雄踞幽州，白馬義從威震塞外。", avatarUrl: "/avatars/gongsun_zan.svg", traits: ["brave", "ambitious", "proud"], cityId: "ji", military: 3, intelligence: 1, charm: 2, skills: { ...S0, tactics: 1, leadership: 2 }, bornTick: -544 },
  { id: "liu_biao", name: "劉表", biography: "荊州牧，單騎入荊州平定亂局，守成有餘進取不足。", avatarUrl: "/avatars/liu_biao.svg", traits: ["cautious", "diplomatic", "wise"], cityId: "jingzhou", military: 0, intelligence: 3, charm: 3, skills: { ...S0, commerce: 2, leadership: 1 }, bornTick: -576 },
  { id: "meng_huo", name: "孟獲", biography: "南蠻王，七擒七縱終心悅誠服，歸順蜀漢。", avatarUrl: "/avatars/meng_huo.svg", traits: ["brave", "proud", "impulsive"], cityId: "guiyang_city", military: 3, intelligence: 0, charm: 2, skills: { ...S0, tactics: 1 }, bornTick: -320 },
  { id: "zhu_rong", name: "祝融夫人", biography: "南蠻女將，火神祝融之後，善使飛刀，武藝高強。", avatarUrl: "/avatars/zhu_rong.svg", traits: ["brave", "loyal", "impulsive"], cityId: "guiyang_city", military: 3, intelligence: 1, charm: 2, skills: { ...S0, tactics: 1 }, bornTick: -320 },
  { id: "tao_qian", name: "陶謙", biography: "徐州牧，三讓徐州於劉備，以仁厚著稱。", avatarUrl: "/avatars/tao_qian.svg", traits: ["humble", "diplomatic", "cautious"], cityId: "beihai", military: 0, intelligence: 2, charm: 3, skills: { ...S0, commerce: 2, leadership: 1 }, bornTick: -576 },
  { id: "lu_zhi", name: "盧植", biography: "海內大儒，劉備之師，曾討黃巾平叛亂。", avatarUrl: "/avatars/lu_zhi.svg", traits: ["wise", "loyal", "humble"], cityId: "liaodong", military: 2, intelligence: 3, charm: 2, skills: { ...S0, leadership: 1, tactics: 1 }, bornTick: -640 },
  { id: "cheng_yu", name: "程昱", biography: "曹操謀臣，多奇計，善斷大事，性格剛戾。", avatarUrl: "/avatars/cheng_yu.svg", traits: ["cunning", "strategic", "ambitious"], cityId: "jinan", military: 0, intelligence: 4, charm: 1, skills: { ...S0, espionage: 2, tactics: 1 }, bornTick: -512 },
];

const cities: PlaceNode[] = [
  // === Major cities (faction capitals) ===
  { id: "chengdu", name: "成都", description: "天府之國，蜀地核心", lat: 30.57, lng: 104.07, status: "allied", tier: "major", controllerId: "liu_bei", gold: 200, garrison: 5, development: 0, specialty: "military_academy", food: 120 },
  { id: "luoyang", name: "洛陽", description: "千年帝都，中原之心", lat: 34.62, lng: 112.45, status: "hostile", tier: "major", controllerId: "cao_cao", gold: 300, garrison: 6, development: 0, specialty: "forge", food: 100 },
  { id: "jianye", name: "南京", description: "六朝古都，江南門戶", lat: 32.06, lng: 118.80, status: "neutral", tier: "major", controllerId: "sun_quan", gold: 250, garrison: 4, development: 0, specialty: "harbor", food: 110 },
  { id: "xiapi", name: "徐州", description: "兵家必爭，五省通衢", lat: 34.32, lng: 117.95, status: "hostile", tier: "major", controllerId: "lu_bu", gold: 150, garrison: 3, development: 0, specialty: "market", food: 80 },
  { id: "changan", name: "西安", description: "十三朝古都", lat: 34.26, lng: 108.94, status: "hostile", tier: "major", controllerId: "cao_cao", gold: 250, garrison: 5, development: 0, specialty: "market", food: 100 },
  { id: "xiangyang", name: "襄陽", description: "荊楚屏障，南北要衝", lat: 32.01, lng: 112.14, status: "neutral", tier: "major", gold: 100, garrison: 0, development: 0, specialty: "library", food: 90 },

  // === Minor cities ===
  // Shu-controlled
  { id: "hanzhong", name: "漢中", description: "蜀道咽喉，北伐前線", lat: 33.07, lng: 107.03, status: "allied", tier: "minor", controllerId: "liu_bei", gold: 80, garrison: 3, development: 0, specialty: "granary", food: 80 },
  { id: "xinye", name: "新野", description: "三顧茅廬之地", lat: 32.52, lng: 112.36, status: "allied", tier: "minor", controllerId: "liu_bei", gold: 50, garrison: 2, development: 0, specialty: "library", food: 50 },
  { id: "jiameng", name: "廣元", description: "蜀北門戶，劍門天險", lat: 32.43, lng: 105.82, status: "allied", tier: "minor", controllerId: "liu_bei", gold: 60, garrison: 2, development: 0, specialty: "granary", food: 70 },
  { id: "jiangzhou", name: "重慶", description: "巴蜀要地，長江上游", lat: 29.56, lng: 106.55, status: "allied", tier: "minor", controllerId: "liu_bei", gold: 80, garrison: 2, development: 0, specialty: "granary", food: 70 },

  // Wei-controlled
  { id: "xuchang", name: "許昌", description: "魏都舊址，中原重鎮", lat: 34.02, lng: 113.85, status: "hostile", tier: "minor", controllerId: "cao_cao", gold: 100, garrison: 3, development: 0, specialty: "forge", food: 60 },
  { id: "ye", name: "邯鄲", description: "河北重鎮，曹魏根基", lat: 36.33, lng: 114.48, status: "hostile", tier: "minor", controllerId: "cao_cao", gold: 80, garrison: 3, development: 0, specialty: "military_academy", food: 60 },
  { id: "hefei", name: "合肥", description: "淮南要塞，吳魏必爭", lat: 31.82, lng: 117.23, status: "hostile", tier: "minor", controllerId: "cao_cao", gold: 60, garrison: 4, development: 0, specialty: "military_academy", food: 50 },
  { id: "puyang", name: "濮陽", description: "中原糧倉，黃河要地", lat: 35.76, lng: 115.03, status: "hostile", tier: "minor", controllerId: "cao_cao", gold: 70, garrison: 2, development: 0, specialty: "granary", food: 80 },
  { id: "chenliu", name: "開封", description: "中原腹地，七朝古都", lat: 34.80, lng: 114.31, status: "hostile", tier: "minor", controllerId: "cao_cao", gold: 100, garrison: 2, development: 0, specialty: "market", food: 60 },

  // Wu-controlled
  { id: "jiangxia", name: "武漢", description: "九省通衢，長江樞紐", lat: 30.55, lng: 114.34, status: "neutral", tier: "minor", controllerId: "sun_quan", gold: 80, garrison: 2, development: 0, specialty: "harbor", food: 60 },
  { id: "kuaiji", name: "紹興", description: "越地名城，東南水鄉", lat: 30.00, lng: 120.58, status: "neutral", tier: "minor", controllerId: "sun_quan", gold: 60, garrison: 2, development: 0, specialty: "harbor", food: 50 },

  // Neutral / contested
  { id: "changsha", name: "長沙", description: "湘楚要地，魚米之鄉", lat: 28.23, lng: 112.94, status: "neutral", tier: "minor", gold: 40, garrison: 0, development: 0, specialty: "market", food: 60 },
  { id: "jingzhou", name: "荊州", description: "荊楚重鎮，兵家必爭", lat: 30.35, lng: 112.19, status: "neutral", tier: "minor", gold: 30, garrison: 0, development: 0, specialty: "granary", food: 60 },
  { id: "tianshui", name: "天水", description: "隴右要地，伏羲故里", lat: 34.58, lng: 105.72, status: "neutral", tier: "minor", gold: 20, garrison: 0, development: 0, specialty: "forge", food: 50 },
  { id: "nanman", name: "昆明", description: "西南邊陲，南中蠻地", lat: 25.04, lng: 102.71, status: "dead", tier: "minor", gold: 10, garrison: 0, development: 0, specialty: "granary", food: 40 },
  { id: "beihai", name: "濰坊", description: "齊魯之地，東海通道", lat: 36.70, lng: 118.97, status: "neutral", tier: "minor", gold: 30, garrison: 0, development: 0, specialty: "harbor", food: 50 },
  { id: "wan", name: "南陽", description: "南陽盆地，兵家重鎮", lat: 32.99, lng: 112.53, status: "neutral", tier: "minor", gold: 40, garrison: 0, development: 0, specialty: "forge", food: 55 },
  { id: "nanhai", name: "廣州", description: "嶺南重鎮，海上絲路", lat: 23.13, lng: 113.26, status: "neutral", tier: "minor", gold: 50, garrison: 0, development: 0, specialty: "market", food: 45 },
  { id: "pingyuan", name: "德州", description: "華北平原，黃河之畔", lat: 37.43, lng: 116.36, status: "neutral", tier: "minor", gold: 20, garrison: 0, development: 0, specialty: "granary", food: 55 },
  { id: "wuling", name: "常德", description: "洞庭西岸，武陵故地", lat: 29.03, lng: 111.69, status: "neutral", tier: "minor", gold: 10, garrison: 0, development: 0, specialty: "library", food: 50 },
  { id: "lingling", name: "永州", description: "瀟湘之源，零陵故地", lat: 26.42, lng: 111.61, status: "neutral", tier: "minor", gold: 10, garrison: 0, development: 0, specialty: "granary", food: 50 },
  { id: "lujiang", name: "廬江", description: "皖南水鄉，廬江舊郡", lat: 31.26, lng: 117.29, status: "neutral", tier: "minor", gold: 20, garrison: 0, development: 0, specialty: "library", food: 50 },
  { id: "shangyong", name: "十堰", description: "上庸故地，秦楚咽喉", lat: 32.63, lng: 110.80, status: "neutral", tier: "minor", gold: 15, garrison: 0, development: 0, specialty: "forge", food: 45 },
  { id: "nanchang", name: "南昌", description: "豫章故郡，贛江要衝", lat: 28.68, lng: 115.86, status: "neutral", tier: "minor", gold: 30, garrison: 0, development: 0, specialty: "granary", food: 55 },
  { id: "wuwei", name: "武威", description: "河西走廊，絲路咽喉", lat: 37.93, lng: 102.64, status: "neutral", tier: "minor", gold: 20, garrison: 0, development: 0, specialty: "forge", food: 40 },
  { id: "ji", name: "北京", description: "幽燕重鎮，北方門戶", lat: 39.90, lng: 116.40, status: "neutral", tier: "minor", gold: 40, garrison: 0, development: 0, specialty: "military_academy", food: 50 },
  { id: "jinyang", name: "太原", description: "晉陽故城，表裡山河", lat: 37.87, lng: 112.55, status: "neutral", tier: "minor", gold: 30, garrison: 0, development: 0, specialty: "forge", food: 50 },
  { id: "liaodong", name: "遼陽", description: "遼東郡治，東北要塞", lat: 41.27, lng: 123.17, status: "neutral", tier: "minor", gold: 10, garrison: 0, development: 0, specialty: "military_academy", food: 40 },

  // === New cities (EU4 area coverage) ===
  { id: "suzhou", name: "蘇州", description: "江南水鄉，魚米富庶", lat: 31.30, lng: 120.62, status: "neutral", tier: "minor", controllerId: "sun_quan", gold: 80, garrison: 0, development: 0, specialty: "market", food: 50 },
  { id: "hangzhou", name: "杭州", description: "錢塘繁華，東南形勝", lat: 30.27, lng: 120.15, status: "neutral", tier: "minor", gold: 40, garrison: 0, development: 0, specialty: "market", food: 55 },
  { id: "fuzhou", name: "福州", description: "閩都要地，海上門戶", lat: 26.07, lng: 119.30, status: "neutral", tier: "minor", gold: 30, garrison: 0, development: 0, specialty: "harbor", food: 45 },
  { id: "jinan", name: "濟南", description: "齊魯首府，泉城名都", lat: 36.65, lng: 116.99, status: "neutral", tier: "minor", gold: 35, garrison: 0, development: 0, specialty: "library", food: 55 },
  { id: "nanning", name: "南寧", description: "嶺南西部，百越之地", lat: 22.82, lng: 108.37, status: "neutral", tier: "minor", gold: 10, garrison: 0, development: 0, specialty: "granary", food: 45 },
  { id: "guiyang_city", name: "貴陽", description: "黔中腹地，夜郎故地", lat: 26.65, lng: 106.63, status: "neutral", tier: "minor", gold: 10, garrison: 0, development: 0, specialty: "forge", food: 40 },
  { id: "zunyi", name: "遵義", description: "黔北門戶，蜀黔要道", lat: 27.73, lng: 106.93, status: "neutral", tier: "minor", gold: 10, garrison: 0, development: 0, specialty: "granary", food: 45 },
  { id: "yangzhou", name: "揚州", description: "淮左名都，運河樞紐", lat: 32.39, lng: 119.42, status: "neutral", tier: "minor", gold: 50, garrison: 0, development: 0, specialty: "market", food: 55 },
];

const relationships: RelationshipEdge[] = [
  // 桃園三結義
  { sourceId: "liu_bei", targetId: "guan_yu", intimacy: 95, relationshipType: "friend" },
  { sourceId: "liu_bei", targetId: "zhang_fei", intimacy: 90, relationshipType: "friend" },
  { sourceId: "guan_yu", targetId: "zhang_fei", intimacy: 85, relationshipType: "friend" },

  // 劉備陣營
  { sourceId: "liu_bei", targetId: "zhuge_liang", intimacy: 92, relationshipType: "friend" },
  { sourceId: "liu_bei", targetId: "zhao_yun", intimacy: 88, relationshipType: "friend" },
  { sourceId: "zhuge_liang", targetId: "zhao_yun", intimacy: 70, relationshipType: "friend" },

  // 對立關係
  { sourceId: "liu_bei", targetId: "cao_cao", intimacy: 20, relationshipType: "rival" },
  { sourceId: "guan_yu", targetId: "cao_cao", intimacy: 45, relationshipType: "neutral" },
  { sourceId: "zhuge_liang", targetId: "zhou_yu", intimacy: 35, relationshipType: "rival" },

  // 孫劉聯盟（微妙）
  { sourceId: "liu_bei", targetId: "sun_quan", intimacy: 50, relationshipType: "neutral" },
  { sourceId: "zhuge_liang", targetId: "sun_quan", intimacy: 55, relationshipType: "neutral" },
  { sourceId: "zhou_yu", targetId: "sun_quan", intimacy: 80, relationshipType: "friend" },

  // 呂布 — 人人喊打
  { sourceId: "lu_bu", targetId: "cao_cao", intimacy: 15, relationshipType: "rival" },
  { sourceId: "lu_bu", targetId: "liu_bei", intimacy: 25, relationshipType: "rival" },
  { sourceId: "lu_bu", targetId: "diao_chan", intimacy: 85, relationshipType: "friend" },

  // 貂蟬的計謀
  { sourceId: "diao_chan", targetId: "cao_cao", intimacy: 40, relationshipType: "neutral" },

  // ── New character relationships ──
  // 夏侯惇↔曹操
  { sourceId: "xiahou_dun", targetId: "cao_cao", intimacy: 90, relationshipType: "friend" },
  // 夏侯淵↔曹操
  { sourceId: "xiahou_yuan", targetId: "cao_cao", intimacy: 85, relationshipType: "friend" },
  // 荀彧↔郭嘉
  { sourceId: "xun_yu", targetId: "guo_jia", intimacy: 80, relationshipType: "friend" },
  // 荀彧↔曹操
  { sourceId: "xun_yu", targetId: "cao_cao", intimacy: 75, relationshipType: "friend" },
  // 郭嘉↔曹操
  { sourceId: "guo_jia", targetId: "cao_cao", intimacy: 80, relationshipType: "friend" },
  // 典韋↔曹操
  { sourceId: "dian_wei", targetId: "cao_cao", intimacy: 85, relationshipType: "friend" },
  // 張遼↔呂布（舊主）
  { sourceId: "zhang_liao", targetId: "lu_bu", intimacy: 60, relationshipType: "friend" },
  // 張遼↔曹操（新主）
  { sourceId: "zhang_liao", targetId: "cao_cao", intimacy: 70, relationshipType: "friend" },
  // 魯肅↔周瑜
  { sourceId: "lu_su", targetId: "zhou_yu", intimacy: 85, relationshipType: "friend" },
  // 魯肅↔孫權
  { sourceId: "lu_su", targetId: "sun_quan", intimacy: 80, relationshipType: "friend" },
  // 呂蒙↔孫權
  { sourceId: "lv_meng", targetId: "sun_quan", intimacy: 75, relationshipType: "friend" },
  // 黃蓋↔孫權
  { sourceId: "huang_gai", targetId: "sun_quan", intimacy: 70, relationshipType: "friend" },
  // 魏延↔諸葛亮（不信任）
  { sourceId: "wei_yan", targetId: "zhuge_liang", intimacy: 45, relationshipType: "neutral" },
  // 姜維↔諸葛亮（師徒）
  { sourceId: "jiang_wei", targetId: "zhuge_liang", intimacy: 90, relationshipType: "friend" },
  // 司馬懿↔曹操（猜忌）
  { sourceId: "sima_yi", targetId: "cao_cao", intimacy: 30, relationshipType: "rival" },
  // 司馬懿↔諸葛亮（宿敵）
  { sourceId: "sima_yi", targetId: "zhuge_liang", intimacy: 20, relationshipType: "rival" },
  // 顏良↔袁紹
  { sourceId: "yan_liang", targetId: "yuan_shao", intimacy: 80, relationshipType: "friend" },
  // 文醜↔袁紹
  { sourceId: "wen_chou", targetId: "yuan_shao", intimacy: 75, relationshipType: "friend" },
  // 顏良↔文醜
  { sourceId: "yan_liang", targetId: "wen_chou", intimacy: 85, relationshipType: "friend" },
  // 袁紹↔曹操（宿敵）
  { sourceId: "yuan_shao", targetId: "cao_cao", intimacy: 25, relationshipType: "rival" },
  // 法正↔劉備
  { sourceId: "fa_zheng", targetId: "liu_bei", intimacy: 80, relationshipType: "friend" },

  // ── New neutral character relationships ──
  // 陸遜↔孫權（主臣）
  { sourceId: "lu_xun", targetId: "sun_quan", intimacy: 75, relationshipType: "friend" },
  // 曹仁↔曹操（族弟）
  { sourceId: "cao_ren", targetId: "cao_cao", intimacy: 85, relationshipType: "friend" },
  // 張郃↔袁紹（舊主）
  { sourceId: "zhang_he", targetId: "yuan_shao", intimacy: 50, relationshipType: "neutral" },
  // 張郃↔曹操（新主）
  { sourceId: "zhang_he", targetId: "cao_cao", intimacy: 60, relationshipType: "friend" },
  // 許褚↔曹操（護衛）
  { sourceId: "xu_chu", targetId: "cao_cao", intimacy: 80, relationshipType: "friend" },
  // 許褚↔典韋（同為護衛）
  { sourceId: "xu_chu", targetId: "dian_wei", intimacy: 70, relationshipType: "friend" },
  // 孫策↔孫權（兄弟）
  { sourceId: "sun_ce", targetId: "sun_quan", intimacy: 90, relationshipType: "friend" },
  // 孫策↔周瑜（義兄弟）
  { sourceId: "sun_ce", targetId: "zhou_yu", intimacy: 90, relationshipType: "friend" },
  // 公孫瓚↔劉備（同窗）
  { sourceId: "gongsun_zan", targetId: "liu_bei", intimacy: 65, relationshipType: "friend" },
  // 公孫瓚↔袁紹（死敵）
  { sourceId: "gongsun_zan", targetId: "yuan_shao", intimacy: 15, relationshipType: "rival" },
  // 劉表↔劉備（宗親）
  { sourceId: "liu_biao", targetId: "liu_bei", intimacy: 55, relationshipType: "neutral" },
  // 孟獲↔祝融夫人（夫妻）
  { sourceId: "meng_huo", targetId: "zhu_rong", intimacy: 90, relationshipType: "friend" },
  // 陶謙↔劉備（讓徐州）
  { sourceId: "tao_qian", targetId: "liu_bei", intimacy: 80, relationshipType: "friend" },
  // 盧植↔劉備（師徒）
  { sourceId: "lu_zhi", targetId: "liu_bei", intimacy: 70, relationshipType: "friend" },
  // 程昱↔曹操（謀臣）
  { sourceId: "cheng_yu", targetId: "cao_cao", intimacy: 75, relationshipType: "friend" },
  // 程昱↔荀彧（同僚）
  { sourceId: "cheng_yu", targetId: "xun_yu", intimacy: 65, relationshipType: "friend" },
];

const roads: RoadEdge[] = [
  // === 蜀道 (mountain, travelTime=3) ===
  { fromCityId: "nanman", toCityId: "chengdu", type: "mountain", travelTime: 3 },
  { fromCityId: "chengdu", toCityId: "jiameng", type: "mountain", travelTime: 3 },
  { fromCityId: "jiameng", toCityId: "hanzhong", type: "mountain", travelTime: 3 },
  { fromCityId: "jiameng", toCityId: "tianshui", type: "mountain", travelTime: 3 },
  { fromCityId: "hanzhong", toCityId: "changan", type: "mountain", travelTime: 3 },
  { fromCityId: "hanzhong", toCityId: "xiangyang", type: "mountain", travelTime: 3 },
  { fromCityId: "changsha", toCityId: "nanman", type: "mountain", travelTime: 3 },
  { fromCityId: "jiangzhou", toCityId: "chengdu", type: "mountain", travelTime: 3 },

  // === 關隴官道 (official, travelTime=1) ===
  { fromCityId: "tianshui", toCityId: "changan", type: "official", travelTime: 1 },

  // === 中原官道 (official, travelTime=1) ===
  { fromCityId: "changan", toCityId: "luoyang", type: "official", travelTime: 1 },
  { fromCityId: "luoyang", toCityId: "xuchang", type: "official", travelTime: 1 },
  { fromCityId: "xuchang", toCityId: "ye", type: "official", travelTime: 1 },
  { fromCityId: "luoyang", toCityId: "xiangyang", type: "official", travelTime: 1 },
  { fromCityId: "xiangyang", toCityId: "xinye", type: "official", travelTime: 1 },
  { fromCityId: "xinye", toCityId: "xuchang", type: "official", travelTime: 1 },
  { fromCityId: "xuchang", toCityId: "xiapi", type: "official", travelTime: 1 },
  { fromCityId: "xiapi", toCityId: "jianye", type: "official", travelTime: 1 },
  { fromCityId: "ye", toCityId: "beihai", type: "official", travelTime: 1 },
  { fromCityId: "beihai", toCityId: "xiapi", type: "official", travelTime: 1 },
  { fromCityId: "xinye", toCityId: "jingzhou", type: "official", travelTime: 1 },
  { fromCityId: "xuchang", toCityId: "jiangxia", type: "official", travelTime: 1 },
  { fromCityId: "jingzhou", toCityId: "changsha", type: "official", travelTime: 1 },

  // New city roads (official)
  { fromCityId: "hefei", toCityId: "jianye", type: "official", travelTime: 1 },
  { fromCityId: "hefei", toCityId: "lujiang", type: "official", travelTime: 1 },
  { fromCityId: "hefei", toCityId: "xuchang", type: "official", travelTime: 1 },
  { fromCityId: "wan", toCityId: "xiangyang", type: "official", travelTime: 1 },
  { fromCityId: "wan", toCityId: "luoyang", type: "official", travelTime: 1 },
  { fromCityId: "wan", toCityId: "xuchang", type: "official", travelTime: 1 },
  { fromCityId: "nanhai", toCityId: "changsha", type: "official", travelTime: 1 },
  { fromCityId: "pingyuan", toCityId: "ye", type: "official", travelTime: 1 },
  { fromCityId: "pingyuan", toCityId: "beihai", type: "official", travelTime: 1 },
  { fromCityId: "wuling", toCityId: "changsha", type: "official", travelTime: 1 },
  { fromCityId: "wuling", toCityId: "jingzhou", type: "official", travelTime: 1 },
  { fromCityId: "lingling", toCityId: "changsha", type: "official", travelTime: 1 },
  { fromCityId: "lujiang", toCityId: "jianye", type: "official", travelTime: 1 },
  { fromCityId: "puyang", toCityId: "ye", type: "official", travelTime: 1 },
  { fromCityId: "puyang", toCityId: "chenliu", type: "official", travelTime: 1 },
  { fromCityId: "chenliu", toCityId: "xuchang", type: "official", travelTime: 1 },
  { fromCityId: "chenliu", toCityId: "luoyang", type: "official", travelTime: 1 },
  { fromCityId: "shangyong", toCityId: "hanzhong", type: "official", travelTime: 1 },
  { fromCityId: "shangyong", toCityId: "xiangyang", type: "official", travelTime: 1 },
  { fromCityId: "nanchang", toCityId: "changsha", type: "official", travelTime: 1 },
  { fromCityId: "nanchang", toCityId: "lujiang", type: "official", travelTime: 1 },
  { fromCityId: "nanchang", toCityId: "kuaiji", type: "official", travelTime: 1 },
  { fromCityId: "wuwei", toCityId: "tianshui", type: "mountain", travelTime: 3 },
  { fromCityId: "wuwei", toCityId: "changan", type: "mountain", travelTime: 3 },
  { fromCityId: "ji", toCityId: "ye", type: "official", travelTime: 1 },
  { fromCityId: "ji", toCityId: "pingyuan", type: "official", travelTime: 1 },
  { fromCityId: "ji", toCityId: "jinyang", type: "official", travelTime: 1 },
  { fromCityId: "ji", toCityId: "liaodong", type: "mountain", travelTime: 3 },
  { fromCityId: "jinyang", toCityId: "luoyang", type: "official", travelTime: 1 },
  { fromCityId: "jinyang", toCityId: "ye", type: "official", travelTime: 1 },
  { fromCityId: "liaodong", toCityId: "pingyuan", type: "mountain", travelTime: 3 },

  // === New EU4 area roads ===
  // Jiangnan / Zhejiang
  { fromCityId: "suzhou", toCityId: "jianye", type: "official", travelTime: 1 },
  { fromCityId: "suzhou", toCityId: "hangzhou", type: "official", travelTime: 1 },
  { fromCityId: "suzhou", toCityId: "yangzhou", type: "official", travelTime: 1 },
  { fromCityId: "hangzhou", toCityId: "kuaiji", type: "official", travelTime: 1 },
  { fromCityId: "hangzhou", toCityId: "nanchang", type: "mountain", travelTime: 3 },
  // Fujian
  { fromCityId: "fuzhou", toCityId: "nanchang", type: "mountain", travelTime: 3 },
  { fromCityId: "fuzhou", toCityId: "hangzhou", type: "waterway", travelTime: 2 },
  // Shandong
  { fromCityId: "jinan", toCityId: "beihai", type: "official", travelTime: 1 },
  { fromCityId: "jinan", toCityId: "chenliu", type: "official", travelTime: 1 },
  { fromCityId: "jinan", toCityId: "ye", type: "official", travelTime: 1 },
  { fromCityId: "jinan", toCityId: "pingyuan", type: "official", travelTime: 1 },
  // Guangxi
  { fromCityId: "nanning", toCityId: "nanhai", type: "official", travelTime: 1 },
  { fromCityId: "nanning", toCityId: "nanman", type: "mountain", travelTime: 3 },
  // Guizhou
  { fromCityId: "guiyang_city", toCityId: "nanman", type: "mountain", travelTime: 3 },
  { fromCityId: "guiyang_city", toCityId: "zunyi", type: "official", travelTime: 1 },
  { fromCityId: "guiyang_city", toCityId: "nanning", type: "mountain", travelTime: 3 },
  { fromCityId: "zunyi", toCityId: "jiangzhou", type: "mountain", travelTime: 3 },
  { fromCityId: "zunyi", toCityId: "wuling", type: "mountain", travelTime: 3 },
  // Huainan
  { fromCityId: "yangzhou", toCityId: "jianye", type: "official", travelTime: 1 },
  { fromCityId: "yangzhou", toCityId: "hefei", type: "official", travelTime: 1 },
  { fromCityId: "yangzhou", toCityId: "xiapi", type: "official", travelTime: 1 },
  // Lingling replacement
  { fromCityId: "lingling", toCityId: "nanhai", type: "mountain", travelTime: 3 },

  // === 長江水路 (waterway, travelTime=2) ===
  { fromCityId: "xiangyang", toCityId: "jingzhou", type: "waterway", travelTime: 2 },
  { fromCityId: "jingzhou", toCityId: "jiangxia", type: "waterway", travelTime: 2 },
  { fromCityId: "changsha", toCityId: "jiangxia", type: "waterway", travelTime: 2 },
  { fromCityId: "jiangxia", toCityId: "jianye", type: "waterway", travelTime: 2 },
  { fromCityId: "jianye", toCityId: "kuaiji", type: "waterway", travelTime: 2 },
  { fromCityId: "kuaiji", toCityId: "beihai", type: "waterway", travelTime: 2 },
  { fromCityId: "jianye", toCityId: "xiapi", type: "waterway", travelTime: 2 },
  { fromCityId: "jiangzhou", toCityId: "jingzhou", type: "waterway", travelTime: 2 },
  { fromCityId: "lujiang", toCityId: "jiangxia", type: "waterway", travelTime: 2 },
];

export async function seedData(repo: IGraphRepository): Promise<void> {
  for (const city of cities) {
    await repo.createPlace(city);
  }
  for (const character of characters) {
    await repo.createCharacter(character);
  }
  for (const relationship of relationships) {
    await repo.setRelationship(relationship);
  }
  for (const road of roads) {
    await repo.createRoad(road);
  }
}

export { characters, relationships, cities, roads };
