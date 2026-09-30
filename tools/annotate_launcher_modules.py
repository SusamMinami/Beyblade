"""Annotate Blender renders; no generated or replacement product imagery."""
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/assets/launcher-modules"
FONT = os.environ.get("LAUNCHER_LABEL_FONT", "C:/Windows/Fonts/msyh.ttc")


def font(size):
    return ImageFont.truetype(FONT, size)


def module_sheet():
    image = Image.open(OUT/"exploded.png").convert("RGB")
    draw = ImageDraw.Draw(image)
    text, muted, line = "#EDF3F5", "#B5C6D0", "#7B94A6"
    draw.text((80, 40), "发射器 · 八模块拆分", font=font(42), fill=text)
    draw.text((80, 99), "基于现有模型  /  可替换结构研究", font=font(23), fill=muted)
    draw.text((1460, 53), "SPIN / CORE", font=font(28), fill=text)
    draw.text((1460, 96), "193 个源网格 · 8 个槽位", font=font(22), fill=muted)
    specs = [
        ("02", "检修上盖", "外观替换 · 透明 / 封闭", (100,230), [(390,259),(500,259),(624,240)]),
        ("06", "传动芯组", "齿轮 / 轴 / 弹簧成套替换", (100,445), [(485,476),(570,476),(702,500)]),
        ("01", "机身外壳", "自由配色 · 护肩与主壳", (100,680), [(425,710),(545,710),(665,737)]),
        ("03", "主握柄", "握持形状 · 胶垫与防滑纹", (135,1190), [(350,1172),(350,1100)]),
        ("05", "驱动齿条", "性能候选 · 行程与传动", (1260,397), [(1340,475),(1340,529),(1260,614)]),
        ("04", "抽拉柄", "操作手感 · 独立更换", (1510,1040), [(1600,1024),(1650,885)]),
        ("07", "陀螺连接头", "性能候选 · 锁合与释放", (650,1150), [(835,1132),(835,1000)]),
        ("08", "释放开关", "内部锁止机构待补齐", (1080,1070), [(1173,1052),(1173,985)]),
    ]
    for number, title, note, pos, points in specs:
        draw.line(points, fill=line, width=2)
        x,y = points[-1]
        draw.ellipse((x-4,y-4,x+4,y+4), fill="#C4D6E2")
        x,y = pos
        draw.text((x,y), number, font=font(31), fill="#97CCEA")
        draw.text((x+59,y), title, font=font(31), fill=text)
        draw.text((x,y+46), note, font=font(22), fill=muted)
    draw.line([(80,1332),(1820,1332)], fill="#66798B", width=1)
    draw.text((80,1360), "优先设计：05 齿条  /  06 传动芯组  /  07 连接头", font=font(25), fill=text)
    draw.text((1110,1362), "结构拆分稿；尚未接入游戏内升级", font=font(23), fill=muted)
    image.save(OUT/"module-sheet.png")


def color_sheet():
    blue, red = [Image.open(OUT/f"assembled-{name}.png").convert("RGB") for name in ["blue","red"]]
    image = Image.new("RGB", (2400,1230), "#27333F")
    image.paste(blue, (0,120))
    image.paste(red, (1200,120))
    draw = ImageDraw.Draw(image)
    draw.text((70,38), "蓝白方案", font=font(40), fill="#EBF1F4")
    draw.text((1270,38), "红黑方案", font=font(40), fill="#EBF1F4")
    draw.text((70,94), "同一组部件 · 主色与辅色独立", font=font(23), fill="#B5C6D0")
    draw.text((1270,94), "参考红色外壳 · 内部金属与齿轮保持原材质", font=font(23), fill="#B5C6D0")
    palettes = json.loads((ROOT/"resources/launcher/study/modules.json").read_text(encoding="utf-8"))["palettes"]
    for x0,key in [(70,"blue_white"),(1270,"red_black")]:
        for i,(zone,label) in enumerate([("primary","主色"),("secondary","辅色"),("chassis","底壳"),
                                          ("grip","胶垫"),("accent","小件"),("window","视窗")]):
            x = x0+i*176
            draw.rounded_rectangle((x,1136,x+35,1171),radius=5,fill=tuple(palettes[key][zone]),
                                   outline="#91A1AD",width=1)
            draw.text((x+48,1137),label,font=font(23),fill="#DAE4EB")
    draw.text((70,1190), "换色预览；两套配色性能相同。色盘、保存和换装交互将在后续接入。",font=font(22),fill="#B5C6D0")
    image.save(OUT/"color-study.png")


if __name__ == "__main__":
    module_sheet()
    color_sheet()
    print("Saved module-sheet.png and color-study.png")
