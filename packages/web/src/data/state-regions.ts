// Thirteen Provinces (十三州) of the late Eastern Han dynasty
// Pure frontend static data — no backend changes needed

export interface StateRegion {
  id: string;
  name: string; // Chinese name
  nameEn: string;
  cityIds: string[];
  labelLat: number;
  labelLng: number;
}

export const STATE_REGIONS: StateRegion[] = [
  {
    id: "sili",
    name: "司隸",
    nameEn: "Sili",
    cityIds: ["luoyang", "changan"],
    labelLat: 34.5,
    labelLng: 110.5,
  },
  {
    id: "yuzhou",
    name: "豫州",
    nameEn: "Yuzhou",
    cityIds: ["xuchang"],
    labelLat: 33.6,
    labelLng: 114.0,
  },
  {
    id: "yanzhou",
    name: "兗州",
    nameEn: "Yanzhou",
    cityIds: ["puyang", "chenliu"],
    labelLat: 35.5,
    labelLng: 115.0,
  },
  {
    id: "xuzhou",
    name: "徐州",
    nameEn: "Xuzhou",
    cityIds: ["xiapi", "yangzhou"],
    labelLat: 33.3,
    labelLng: 118.5,
  },
  {
    id: "qingzhou",
    name: "青州",
    nameEn: "Qingzhou",
    cityIds: ["beihai", "jinan", "pingyuan"],
    labelLat: 37.0,
    labelLng: 118.2,
  },
  {
    id: "jizhou",
    name: "冀州",
    nameEn: "Jizhou",
    cityIds: ["ye"],
    labelLat: 36.8,
    labelLng: 114.0,
  },
  {
    id: "youzhou",
    name: "幽州",
    nameEn: "Youzhou",
    cityIds: ["ji", "liaodong"],
    labelLat: 40.5,
    labelLng: 118.5,
  },
  {
    id: "bingzhou",
    name: "并州",
    nameEn: "Bingzhou",
    cityIds: ["jinyang"],
    labelLat: 38.5,
    labelLng: 112.0,
  },
  {
    id: "liangzhou",
    name: "涼州",
    nameEn: "Liangzhou",
    cityIds: ["tianshui", "wuwei"],
    labelLat: 36.5,
    labelLng: 103.5,
  },
  {
    id: "yizhou",
    name: "益州",
    nameEn: "Yizhou",
    cityIds: ["chengdu", "hanzhong", "jiameng", "jiangzhou", "nanman", "guiyang_city", "zunyi"],
    labelLat: 28.5,
    labelLng: 105.5,
  },
  {
    id: "jingzhou_region",
    name: "荊州",
    nameEn: "Jingzhou",
    cityIds: ["xiangyang", "xinye", "jingzhou", "jiangxia", "changsha", "wuling", "lingling", "shangyong", "wan"],
    labelLat: 30.0,
    labelLng: 112.0,
  },
  {
    id: "yangzhou_region",
    name: "揚州",
    nameEn: "Yangzhou",
    cityIds: ["jianye", "hefei", "kuaiji", "lujiang", "suzhou", "hangzhou", "fuzhou", "nanchang"],
    labelLat: 29.5,
    labelLng: 118.5,
  },
  {
    id: "jiaozhou",
    name: "交州",
    nameEn: "Jiaozhou",
    cityIds: ["nanhai", "nanning"],
    labelLat: 22.8,
    labelLng: 110.5,
  },
];

// Lookup map: cityId -> regionId
export const CITY_TO_REGION: Record<string, string> = {};
for (const region of STATE_REGIONS) {
  for (const cityId of region.cityIds) {
    CITY_TO_REGION[cityId] = region.id;
  }
}

// Lookup map: regionId -> StateRegion
export const REGION_BY_ID: Record<string, StateRegion> = {};
for (const region of STATE_REGIONS) {
  REGION_BY_ID[region.id] = region;
}
