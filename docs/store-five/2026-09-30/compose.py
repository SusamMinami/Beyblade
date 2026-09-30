"""Compose a store-image design proposal from unmodified browser captures."""
from pathlib import Path
import hashlib
import json

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT / "posters"
OUT.mkdir(exist_ok=True)
FONT = Path("C:/Windows/Fonts/msyh.ttc")
BOLD = Path("C:/Windows/Fonts/msyhbd.ttc")
W, H = 1080, 1920
INK, PAPER, BLUE = "#12151a", "#fffdf7", "#238cff"
DARK, WHITE = "#081a24", "#eef6f3"
records = []


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else FONT), size)


def text(image, xy, value, size=36, color=INK, bold=False):
    draw = ImageDraw.Draw(image)
    face = font(size, bold)
    box = draw.textbbox(xy, value, font=face)
    assert box[2] <= W - 24 and box[3] <= H - 12, (value, box)
    draw.text(xy, value, font=face, fill=color, anchor="lt")


def crop(image, source, box, xy, width):
    with Image.open(RAW / source) as original:
        assert original.size == (W, H), (source, original.size)
        patch = original.convert("RGB").crop(box)
    height = round(patch.height * width / patch.width)
    assert xy[0] >= 0 and xy[1] >= 0 and xy[0] + width <= W and xy[1] + height <= H
    image.paste(patch.resize((width, height), Image.Resampling.LANCZOS), xy)
    records[-1]["regions"].append({
        "source": f"raw/{source}", "sourceBox": box,
        "outputBox": [xy[0], xy[1], xy[0] + width, xy[1] + height],
    })
    return height


def canvas(index, topic, lines, sub, dark=False):
    accent = "#efc579" if index == 5 else "#5fd8d5" if dark else BLUE
    fg = WHITE if dark else INK
    muted = "#b1cdcf" if dark else "#4d555d"
    image = Image.new("RGB", (W, H), DARK if dark else PAPER)
    records.append({"file": f"posters/{index:02d}-{topic}.png", "regions": [],
                    "headline": "，".join(lines), "subtitle": sub})
    text(image, (48, 44), "战斗陀螺", 34, fg, True)
    text(image, (830, 49), f"0{index} / 05", 28, muted)
    text(image, (42, 128), lines[0] + "，", 108, fg, True)
    text(image, (42, 256), lines[1], 108, accent, True)
    text(image, (48, 404), sub, 36, muted)
    text(image, (48, 1878), "当前 Web 版本画面 · 截图裁切排版提案", 23, muted)
    return image


def save(image):
    metadata = PngImagePlugin.PngInfo()
    metadata.add_itxt("Source", "Actual local Battle Top Web prototype screenshots captured 2026-09-30.")
    metadata.add_itxt("Composition", json.dumps(records[-1], ensure_ascii=False))
    metadata.add_itxt("Status", "Store-image design proposal; screenshot crops and typography only; no generated gameplay imagery.")
    image.save(ROOT / records[-1]["file"], pnginfo=metadata)


# 01: A wide arena scene plus a clearly identified detail from the same frame.
im = canvas(1, "battle", ["这一撞", "够痛快"], "物理驱动的 3D 陀螺对战", True)
crop(im, "01-battle.png", (65, 450, 1015, 1492), (48, 500), 984)
crop(im, "01-battle.png", (355, 932, 700, 1190), (540, 1430), 488)
text(im, (550, 1809), "碰撞瞬间 · 局部放大", 27, "#b1cdcf")
text(im, (48, 1650), "发射 · 走位", 42, WHITE, True)
text(im, (48, 1725), "碰撞 · 抢区", 42, "#5fd8d5", True)
save(im)

# 02: The selected real part is large; the lower strips prove the live DIY tools.
im = canvas(2, "assembly", ["你的陀螺", "你来造"], "五大部件自由组装，造型性能一起改")
crop(im, "02-assembly.png", (30, 690, 1050, 1490), (30, 500), 1020)
text(im, (48, 1340), "直接改造零件", 38, INK, True)
crop(im, "02-diy.png", (0, 0, 1080, 218), (48, 1410), 984)
crop(im, "02-diy.png", (20, 1700, 1060, 1905), (48, 1650), 984)
save(im)

# 03: Exploded mechanical model and actual slot/variant/color controls.
im = canvas(3, "launcher", ["这一拉", "也有门道"], "换装发射器，配出你的起手优势")
crop(im, "03-launcher.png", (120, 576, 942, 1148), (48, 500), 984)
text(im, (48, 1220), "齿条 · 传动芯组 · 连接头", 38, INK, True)
crop(im, "03-launcher.png", (32, 1148, 1048, 1714), (48, 1300), 984)
save(im)

# 04: A real contact close-up and its actual oil feedback, not an invented bonus.
im = canvas(4, "maintenance", ["亲手保养", "越玩越懂"], "直接滴油、擦拭，观察性能变化")
crop(im, "04-maintenance.png", (20, 564, 1060, 1254), (48, 500), 984)
crop(im, "04-maintenance.png", (32, 1254, 1048, 1605), (48, 1240), 984)
text(im, (48, 1670), "哪里上油，上多少", 42, INK, True)
text(im, (48, 1740), "都能亲手试一试", 42, BLUE, True)
save(im)

# 05: Two actual world views, followed by the actual first story mission.
im = canvas(5, "journey", ["从街头", "迎战宿敌"], "五章十战，带上你的改装一路出发", True)
crop(im, "05-street.png", (0, 410, 1080, 1490), (48, 500), 480)
crop(im, "05-ruins.png", (0, 410, 1080, 1490), (552, 500), 480)
text(im, (48, 1008), "街头对决", 30, WHITE, True)
text(im, (552, 1008), "浮空遗迹", 30, WHITE, True)
text(im, (48, 1120), "从「它还会转」开始", 44, "#efc579", True)
crop(im, "05-journey.png", (32, 650, 1048, 1210), (48, 1220), 984)
text(im, (48, 1790), "回声远征 · 你的陀螺，你的故事", 32, "#b1cdcf")
save(im)

# One compact review board; each individual PNG remains full resolution.
board = Image.new("RGB", (2000, 874), "#e5e8e7")
d = ImageDraw.Draw(board)
d.text((34, 26), "战斗陀螺 / 商店五图", fill=INK, font=font(38, True))
d.text((34, 80), "真实游戏截图 + 文案构图提案 · 单张 1080 × 1920 · 2026-09-30",
       fill="#4d555d", font=font(22))
for i, record in enumerate(records):
    with Image.open(ROOT / record["file"]) as original:
        board.paste(original.resize((372, 661), Image.Resampling.LANCZOS), (34 + 390 * i, 132))
    d.text((34 + 390 * i, 815), f"0{i + 1}  " + ["物理对战", "自由改装", "发射器", "直接保养", "故事远征"][i],
           fill=INK, font=font(24, True))
board.save(ROOT / "five-image-preview.png")

sources = {}
for record in records:
    for region in record["regions"]:
        source = ROOT / region["source"]
        sources[region["source"]] = hashlib.sha256(source.read_bytes()).hexdigest()
(ROOT / "composition.json").write_text(json.dumps({
    "status": "proposal", "size": [W, H],
    "operations": "crop, uniform resize, text composition; gameplay images unchanged",
    "sourceSha256": sources, "posters": records,
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Created {len(records)} posters, five-image-preview.png and composition.json")
