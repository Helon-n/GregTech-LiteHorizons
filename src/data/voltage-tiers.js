// Extracted from 资料/voltage-tier-styles.html. Regenerate with node scripts/import-voltage-styles.mjs.
export const VOLTAGE_ERAS = [
  {
    "name": "基础工业",
    "range": "8 – 512 EU/t"
  },
  {
    "name": "精密高压",
    "range": "2k – 131k EU/t"
  },
  {
    "name": "终极星体",
    "range": "524k – 8.4M EU/t"
  },
  {
    "name": "超越极限",
    "range": "33M – MAX"
  }
];

export const VOLTAGE_TIERS = [
  {
    "code": "ULV",
    "index": 0,
    "era": 0,
    "name": "锻铁时代",
    "fullName": "Ultra Low Voltage",
    "voltage": "8 EU/t",
    "voltageShort": "8 EU/t",
    "material": "锻铁",
    "materialEn": "Wrought Iron",
    "palette": {
      "accent": [
        "#d47a4f",
        "#f0b48a"
      ],
      "casing": [
        "#433a33",
        "#2f2924",
        "#1d1916"
      ],
      "panel": [
        "#2b2723",
        "#191613"
      ]
    },
    "background": "#0d0b09",
    "lcdBackground": "#140d08",
    "texture": "hammer",
    "detail": "gauge",
    "light": false,
    "tags": [
      "锻铁",
      "外露铆钉",
      "琥珀表"
    ],
    "spec": {
      "texture": "粗锻 · 外露铆钉",
      "glow": "琥珀白炽灯",
      "progress": "机械刻度"
    },
    "description": "粗锻铁板、外露铆钉和琥珀色机械表。边框厚重，读数靠指针而不是数码管——这是第一代电气的样子。"
  },
  {
    "code": "LV",
    "index": 1,
    "era": 0,
    "name": "铜线电气",
    "fullName": "Low Voltage",
    "voltage": "32 EU/t",
    "voltageShort": "32 EU/t",
    "material": "钢",
    "materialEn": "Steel",
    "palette": {
      "accent": [
        "#7fae6a",
        "#b87333"
      ],
      "casing": [
        "#33423a",
        "#24312a",
        "#151d18"
      ],
      "panel": [
        "#243026",
        "#121a15"
      ]
    },
    "background": "#0a0f0b",
    "lcdBackground": "#07110a",
    "texture": "paint",
    "detail": "coil",
    "light": false,
    "tags": [
      "墨绿漆",
      "铜母线",
      "瓷瓶"
    ],
    "spec": {
      "texture": "墨绿漆 · 铜缝",
      "glow": "铜绿指示灯",
      "progress": "分段铜绿"
    },
    "description": "墨绿漆钢壳、铜母线和瓷瓶绝缘子。功率不大，但已经有真正的工厂秩序：保险丝、指示灯与黄铜铭牌。"
  },
  {
    "code": "MV",
    "index": 2,
    "era": 0,
    "name": "铝制工厂",
    "fullName": "Medium Voltage",
    "voltage": "128 EU/t",
    "voltageShort": "128 EU/t",
    "material": "铝",
    "materialEn": "Aluminium",
    "palette": {
      "accent": [
        "#d8ae4e",
        "#e6d7b0"
      ],
      "casing": [
        "#4d565a",
        "#394145",
        "#252c2f"
      ],
      "panel": [
        "#2b3336",
        "#171d20"
      ]
    },
    "background": "#0d0f10",
    "lcdBackground": "#101308",
    "texture": "brushed",
    "detail": "vent",
    "light": false,
    "tags": [
      "拉丝铝",
      "百叶",
      "安全金"
    ],
    "spec": {
      "texture": "拉丝 · 冲压百叶",
      "glow": "金色安全灯",
      "progress": "金色分段"
    },
    "description": "拉丝铝板、冲压百叶窗和金色安全标牌。机器开始标准化、模块化，像一条可以被复制的产线。"
  },
  {
    "code": "HV",
    "index": 3,
    "era": 0,
    "name": "陶瓷与警示",
    "fullName": "High Voltage",
    "voltage": "512 EU/t",
    "voltageShort": "512 EU/t",
    "material": "不锈钢",
    "materialEn": "Stainless Steel",
    "palette": {
      "accent": [
        "#e6c93f",
        "#e8e3d5"
      ],
      "casing": [
        "#454f54",
        "#343d42",
        "#22292d"
      ],
      "panel": [
        "#2a3236",
        "#171d20"
      ]
    },
    "background": "#0e0f0b",
    "lcdBackground": "#0d1008",
    "texture": "brushed",
    "detail": "hazard",
    "light": false,
    "tags": [
      "厚不锈钢",
      "陶瓷",
      "警示带"
    ],
    "spec": {
      "texture": "厚板 · 警示带",
      "glow": "黄黑警示灯",
      "progress": "警示条纹"
    },
    "description": "厚不锈钢、白色陶瓷绝缘子和黄黑警示带。高压第一次变得危险：粗边框、大标牌、明确的断电区。"
  },
  {
    "code": "EV",
    "index": 4,
    "era": 1,
    "name": "真空精密",
    "fullName": "Extreme Voltage",
    "voltage": "2,048 EU/t",
    "voltageShort": "2k EU/t",
    "material": "钛",
    "materialEn": "Titanium",
    "palette": {
      "accent": [
        "#b9c6cd",
        "#b58cff"
      ],
      "casing": [
        "#3f4a50",
        "#2f383d",
        "#1d252a"
      ],
      "panel": [
        "#242c31",
        "#12181c"
      ]
    },
    "background": "#0b0e10",
    "lcdBackground": "#081014",
    "texture": "glass",
    "detail": "viewport",
    "light": false,
    "tags": [
      "钛",
      "真空视窗",
      "冷弧"
    ],
    "spec": {
      "texture": "密封 · 真空视窗",
      "glow": "冷白电弧",
      "progress": "细白光条"
    },
    "description": "钛壳、圆形真空视窗和一道冷白电弧。铆钉退场，螺栓变细，颜色收敛到只剩光和影。"
  },
  {
    "code": "IV",
    "index": 5,
    "era": 1,
    "name": "等离子工业",
    "fullName": "Insane Voltage",
    "voltage": "8,192 EU/t",
    "voltageShort": "8k EU/t",
    "material": "钨钢",
    "materialEn": "Tungstensteel",
    "palette": {
      "accent": [
        "#5b9dff",
        "#6fe6ff"
      ],
      "casing": [
        "#353e45",
        "#252d33",
        "#141a1f"
      ],
      "panel": [
        "#1f272e",
        "#0e1419"
      ]
    },
    "background": "#090d12",
    "lcdBackground": "#061018",
    "texture": "hex",
    "detail": "plasma",
    "light": false,
    "tags": [
      "钨钢",
      "等离子管",
      "六角网"
    ],
    "spec": {
      "texture": "六角网 · 等离子",
      "glow": "钴蓝等离子",
      "progress": "蓝色光段"
    },
    "description": "钨钢骨架、蓝色等离子导管和六角散热网。机械连杆让位给细长的光路，能量开始成为结构本身。"
  },
  {
    "code": "LuV",
    "index": 6,
    "era": 1,
    "name": "镜面校准",
    "fullName": "Ludicrous Voltage",
    "voltage": "32,768 EU/t",
    "voltageShort": "32k EU/t",
    "material": "铑钯",
    "materialEn": "Rhodium-Plated Palladium",
    "palette": {
      "accent": [
        "#cf8aff",
        "#ff9bd8"
      ],
      "casing": [
        "#4b4655",
        "#37323f",
        "#221e29"
      ],
      "panel": [
        "#272330",
        "#14111b"
      ]
    },
    "background": "#0d0a10",
    "lcdBackground": "#100a16",
    "texture": "mirror",
    "detail": "halo",
    "light": false,
    "tags": [
      "铑钯镜面",
      "品红光环",
      "蚀刻"
    ],
    "spec": {
      "texture": "镜面 · 蚀刻",
      "glow": "品红光环",
      "progress": "品红渐变"
    },
    "description": "镜面铑钯、品红光环和极细的蚀刻字。它不再像一台机器，更像一件被校准过的仪器——冷、贵、精确。"
  },
  {
    "code": "ZPM",
    "index": 7,
    "era": 1,
    "name": "零点核心",
    "fullName": "Zero Point Module",
    "voltage": "131,072 EU/t",
    "voltageShort": "131k EU/t",
    "material": "铱",
    "materialEn": "Iridium",
    "palette": {
      "accent": [
        "#4fd6c9",
        "#a5f5ec"
      ],
      "casing": [
        "#36403f",
        "#242d2c",
        "#121817"
      ],
      "panel": [
        "#1d2524",
        "#0d1413"
      ]
    },
    "background": "#080f0e",
    "lcdBackground": "#04110f",
    "texture": "vein",
    "detail": "core",
    "light": false,
    "tags": [
      "铱",
      "能量脉",
      "核心"
    ],
    "spec": {
      "texture": "黑镜 · 能量脉",
      "glow": "青色核心",
      "progress": "青色脉冲"
    },
    "description": "铱黑外壳、青色能量脉和一枚看不见起点的核心。铆钉完全消失，接缝像晶体自己生长出来的。"
  },
  {
    "code": "UV",
    "index": 8,
    "era": 2,
    "name": "锇晶折射",
    "fullName": "Ultimate Voltage",
    "voltage": "524,288 EU/t",
    "voltageShort": "524k EU/t",
    "material": "锇",
    "materialEn": "Osmium",
    "palette": {
      "accent": [
        "#5fd98a",
        "#b0ffd0"
      ],
      "casing": [
        "#3e4f53",
        "#2c3a3d",
        "#1a2527"
      ],
      "panel": [
        "#223032",
        "#101a1b"
      ]
    },
    "background": "#080e0a",
    "lcdBackground": "#04120c",
    "texture": "crystal",
    "detail": "crystal",
    "light": false,
    "tags": [
      "锇",
      "晶体窗",
      "悬浮环"
    ],
    "spec": {
      "texture": "晶体 · 折射",
      "glow": "翠绿晶体",
      "progress": "晶体光条"
    },
    "description": "锇蓝银、翠绿晶体窗和悬浮环。机壳开始折射环境光，像是从矿石里长出来的设备。"
  },
  {
    "code": "UHV",
    "index": 9,
    "era": 2,
    "name": "中子星环",
    "fullName": "Ultimate High Voltage",
    "voltage": "2,097,152 EU/t",
    "voltageShort": "2M EU/t",
    "material": "中子素",
    "materialEn": "Neutronium",
    "palette": {
      "accent": [
        "#ff6b6b",
        "#ffb0a0"
      ],
      "casing": [
        "#262b30",
        "#181d21",
        "#0c0f12"
      ],
      "panel": [
        "#1b2024",
        "#0b0f11"
      ]
    },
    "background": "#0e0909",
    "lcdBackground": "#120606",
    "texture": "star",
    "detail": "orbit",
    "light": false,
    "tags": [
      "中子素",
      "赤红星环",
      "重力"
    ],
    "spec": {
      "texture": "致密 · 星环",
      "glow": "赤红事件视界",
      "progress": "星环轨道"
    },
    "description": "中子素黑壳、赤红星环和重力甲板。物质被压到极限，界面只剩下最少的线和一个事件视界。"
  },
  {
    "code": "UEV",
    "index": 10,
    "era": 2,
    "name": "基岩折层",
    "fullName": "Ultimate Extreme Voltage",
    "voltage": "8,388,608 EU/t",
    "voltageShort": "8M EU/t",
    "material": "基岩",
    "materialEn": "Bedrockium",
    "palette": {
      "accent": [
        "#9b6bff",
        "#d6b0ff"
      ],
      "casing": [
        "#2b2520",
        "#1b1612",
        "#0d0a08"
      ],
      "panel": [
        "#211c18",
        "#100d0b"
      ]
    },
    "background": "#0c090f",
    "lcdBackground": "#0c0614",
    "texture": "fold",
    "detail": "fold",
    "light": false,
    "tags": [
      "基岩",
      "紫外折层",
      "暗面"
    ],
    "spec": {
      "texture": "暗面 · 折层",
      "glow": "紫外折光",
      "progress": "折层光带"
    },
    "description": "基岩般的暗壳被紫外光折成斜切面。边框不再是矩形，像空间本身被折叠了一角。"
  },
  {
    "code": "UIV",
    "index": 11,
    "era": 3,
    "name": "黑钚巨石",
    "fullName": "Ultimate Insane Voltage",
    "voltage": "33,554,432 EU/t",
    "voltageShort": "33M EU/t",
    "material": "黑钚",
    "materialEn": "Black Plutonium",
    "palette": {
      "accent": [
        "#6b7cff",
        "#b0c0ff"
      ],
      "casing": [
        "#1f1d27",
        "#14121b",
        "#08070c"
      ],
      "panel": [
        "#18161f",
        "#0a090f"
      ]
    },
    "background": "#090910",
    "lcdBackground": "#060814",
    "texture": "monolith",
    "detail": "seam",
    "light": false,
    "tags": [
      "黑钚",
      "靛蓝接缝",
      "巨石"
    ],
    "spec": {
      "texture": "巨石 · 接缝",
      "glow": "靛蓝接缝",
      "progress": "靛蓝脉冲"
    },
    "description": "黑钚巨石般的整块外壳，只有一条靛蓝接缝发光。它看起来不可拆解，也不打算被拆解。"
  },
  {
    "code": "UMV",
    "index": 12,
    "era": 3,
    "name": "时空编织",
    "fullName": "Ultimate Mega Voltage",
    "voltage": "134,217,728 EU/t",
    "voltageShort": "134M EU/t",
    "material": "时空",
    "materialEn": "SpaceTime",
    "palette": {
      "accent": [
        "#ff5fa2",
        "#6bffd8"
      ],
      "casing": [
        "#25222c",
        "#17141d",
        "#0a090e"
      ],
      "panel": [
        "#1d1a23",
        "#0d0b11"
      ]
    },
    "background": "#0c080d",
    "lcdBackground": "#120510",
    "texture": "weave",
    "detail": "weave",
    "light": false,
    "tags": [
      "时空合金",
      "油膜虹彩",
      "编织"
    ],
    "spec": {
      "texture": "油膜 · 编织",
      "glow": "虹彩边缘",
      "progress": "虹彩流线"
    },
    "description": "时空合金的油膜虹彩，品红边缘在缓慢移动。没有螺丝、没有焊缝，只有编织般流动的金属。"
  },
  {
    "code": "UXV",
    "index": 13,
    "era": 3,
    "name": "星物质",
    "fullName": "Ultimate eXtended Mega Voltage",
    "voltage": "536,870,912 EU/t",
    "voltageShort": "536M EU/t",
    "material": "星物质",
    "materialEn": "Star Matter",
    "palette": {
      "accent": [
        "#ff7a4f",
        "#4fe8ff"
      ],
      "casing": [
        "#131318",
        "#09090c",
        "#030304"
      ],
      "panel": [
        "#101014",
        "#050507"
      ]
    },
    "background": "#0d090b",
    "lcdBackground": "#0d0508",
    "texture": "plasma",
    "detail": "star",
    "light": false,
    "tags": [
      "星物质",
      "霓虹",
      "负空间"
    ],
    "spec": {
      "texture": "黑壳 · 等离子",
      "glow": "珊瑚 / 青双色",
      "progress": "双色霓虹"
    },
    "description": "黑壳里关着一小片恒星物质，霓虹珊瑚与青色等离子交替呼吸。界面几乎只剩下光。"
  },
  {
    "code": "MAX",
    "index": 14,
    "era": 3,
    "name": "创造全谱",
    "fullName": "Maximum Voltage",
    "voltage": "∞ EU/t",
    "voltageShort": "∞ EU/t",
    "material": "创造",
    "materialEn": "Creative",
    "palette": {
      "accent": [
        "#b8862f",
        "#7a5cff"
      ],
      "casing": [
        "#f7f4ec",
        "#e7e2d6",
        "#d3cec0"
      ],
      "panel": [
        "#f4f1e8",
        "#dcd7ca"
      ]
    },
    "background": "#e7e3d7",
    "lcdBackground": "#171207",
    "texture": "prism",
    "detail": "prism",
    "light": true,
    "tags": [
      "创造外壳",
      "金色包边",
      "全光谱"
    ],
    "spec": {
      "texture": "白金 · 全光谱",
      "glow": "金色包边",
      "progress": "彩虹全谱"
    },
    "description": "创造外壳、金色包边和全光谱流光。它不再遵守前十四级的材质规则——所有风格在这里被合成。"
  }
];
