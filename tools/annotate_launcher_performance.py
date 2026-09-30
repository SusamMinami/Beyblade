"""Build Chinese review boards from the actual Blender product renders."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"docs/assets/launcher-performance"
MANIFEST=ROOT/"resources/launcher/performance/parts.json"
TEXT="#E6EEF0"
MUTED="#AEBEC7"
LINE="#6F8999"
COLORS=["#83B9D6","#DFA57C","#8CC8B9"]


def font(size):
    return ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",size)


def text(draw,point,value,size=24,fill=TEXT):
    draw.text(point,value,font=font(size),fill=fill)


def board():
    manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
    image=Image.new("RGB",(2400,2660),"#172129")
    draw=ImageDraw.Draw(image)
    text(draw,(64,38),"SPIN / CORE",30)
    text(draw,(64,82),"性能部件 · 三个槽位，九种选择",48)
    text(draw,(1670,58),"01  /  PERFORMANCE PARTS",25,MUTED)
    text(draw,(1670,103),"独立混搭 · 外壳颜色不影响性能",23,MUTED)
    rows=[
        ("05 / 驱动齿条","往复惯量 × 抗弯刚性",180,["R01","R02","R03"],730,358),
        ("06 / 传动芯组","输出转速 × 所需拉力",755,["T01","T02","T03"],710,671),
        ("07 / 陀螺连接头","退出路径 × 支承跨度",1640,["C01","C02","C03"],710,671),
    ]
    captions={
        "R01":("连续背梁，负担与刚性平衡","取舍：不追求极端轻量或高载刚性"),
        "R02":("贯通开窗，降低往复件惯量","取舍：高载下的挠曲更明显"),
        "R03":("嵌入金属背脊，抑制大拉力变形","取舍：快速起拉需要更多力"),
        "T01":("32 : 32  ·  输出 / 输入转速 = 1.000","定位：新系统的均衡标定参考"),
        "T02":("36 : 28  ·  输出 / 输入转速 = 1.286","取舍：同输出负载需要更大拉力"),
        "T03":("28 : 36  ·  输出 / 输入转速 = 0.778","取舍：同抽速下输出转速更低"),
        "C01":("标准三爪与单组支承","定位：导向长度与运转阻力平衡"),
        "C02":("短导向裙与轻量转子","取舍：对偏斜轴线的约束行程更短"),
        "C03":("双组轴承与连续导向裙","取舍：增加支承拖曳和转动惯量"),
    }
    by_code={s["code"]:s for s in manifest["parts"]}
    for label,note,y,codes,w,h in rows:
        draw.line([(64,y),(2336,y)],fill=LINE,width=1)
        text(draw,(64,y+18),label,28)
        text(draw,(1770,y+21),note,24,MUTED)
        for i,code in enumerate(codes):
            x=64+i*785
            spec=by_code[code]
            draw.rectangle((x,y+77,x+5,y+111),fill=COLORS[i])
            text(draw,(x+20,y+74),code+"  "+spec["name"],32,COLORS[i])
            text(draw,(x+335,y+82),spec["family"],23,MUTED)
            source=Image.open(OUT/(code+".png")).convert("RGB").resize((w,h),Image.Resampling.LANCZOS)
            image.paste(source,(x,y+130))
            a,b=captions[code]
            text(draw,(x,y+143+h),a,25)
            text(draw,(x,y+183+h),b,22,MUTED)
    draw.line([(64,2525),(2336,2525)],fill=LINE,width=1)
    text(draw,(64,2550),"共用接口 · 可拆开查看 · 可逐件替换",28)
    text(draw,(64,2600),"结构设计稿；齿比为理想传动关系，性能收益尚未进入游戏数值。",23,MUTED)
    image.save(OUT/"parts-board.png")


def callout(draw,number,title,note,xy,points,color="#A4CFE1"):
    draw.line(points,fill=LINE,width=2)
    x,y=points[-1]
    draw.ellipse((x-4,y-4,x+4,y+4),fill=color)
    x,y=xy
    text(draw,(x,y),number,31,color)
    text(draw,(x+61,y),title,30)
    text(draw,(x,y+45),note,21,MUTED)


def exploded():
    image=Image.open(OUT/"exploded.png").convert("RGB")
    draw=ImageDraw.Draw(image)
    text(draw,(80,40),"升级时，就这样拆开",44)
    text(draw,(80,101),"同一套装配模型  /  沿用八模块锚点与拆解路径",24,MUTED)
    text(draw,(1400,53),"R01 + T02 + C03",29)
    text(draw,(1400,98),"独立混搭示例",22,MUTED)
    callout(draw,"02","打开检修盖","外壳配色保持玩家选择",(100,230),
            [(405,261),(500,261),(624,240)])
    callout(draw,"06","T02 超越芯组","整组替换，内部齿轮还可继续展开",(90,438),
            [(455,474),(565,474),(702,500)],COLORS[1])
    callout(draw,"01","共用机身","导轨开口与输出轴孔已补齐",(100,680),
            [(420,710),(545,710),(665,737)])
    callout(draw,"05","R01 循衡齿条","三款共用齿距、导轨和连接销",(1260,397),
            [(1340,476),(1340,530),(1260,614)],COLORS[0])
    callout(draw,"07","C03 定轴连接头","双支承；陀螺安装位置保持一致",(640,1145),
            [(835,1127),(835,1000)],COLORS[2])
    callout(draw,"04","抽拉柄","端部销连接可独立检查",(1480,1060),
            [(1590,1040),(1650,885)])
    text(draw,(100,1200),"03 / 主握柄",26,MUTED)
    text(draw,(1100,1110),"08 / 释放开关",26,MUTED)
    text(draw,(1100,1150),"内部联动仍待深化",21,MUTED)
    draw.line([(80,1330),(1820,1330)],fill=LINE,width=1)
    text(draw,(80,1360),"选中槽位 → 移出旧件 → 放入新件 → 合拢",27)
    text(draw,(1180,1363),"模型与动画已制作 · 游戏交互待接入",22,MUTED)
    image.save(OUT/"upgrade-exploded.png")


def detail():
    image=Image.open(OUT/"transmission-detail.png").convert("RGB")
    draw=ImageDraw.Draw(image)
    text(draw,(64,37),"06 / 芯组里面是什么",42)
    text(draw,(64,97),"T02 超越 · 两层传动，按机构保留独立节点",24,MUTED)
    bounds=json.loads((OUT/"detail-projection.json").read_text(encoding="utf-8"))
    items=[
        ("A","回位弹簧","仅回位储能，不提供免费加速","return_spring",(70,205)),
        ("B","轴承桥","上支承与固定支架","bearing_bridge",(1220,290)),
        ("C","输入转子","36 齿输入轮\n36 齿上层驱动轮","input_rotor",(1260,750)),
        ("D","输出转子","28 齿输出轮 + 圆轴颈 / 六方端","output_rotor",(70,650)),
        ("E","托板与下支承","统一底座、孔位与输出中心","tray",(70,1135)),
    ]
    for number,title,note,key,pos in items:
        a,b,c,d=bounds[key]
        target=(int((a+c)/2*1600),int((b+d)/2*1500))
        x,y=pos
        edge=(x+390,y+27) if x<500 else (x-20,y+27)
        callout(draw,number,title,note,pos,[edge,((edge[0]+target[0])/2,edge[1]),target])
    draw.line([(64,1380),(1536,1380)],fill=LINE,width=1)
    text(draw,(64,1405),"输出 / 输入转速 = 36 / 28 ≈ 1.286",27,COLORS[1])
    text(draw,(64,1450),"理想齿比；齿面接触、弹簧回位与战斗收益尚未模拟。",23,MUTED)
    image.save(OUT/"transmission-section.png")


if __name__=="__main__":
    board()
    exploded()
    detail()
    print("Saved performance review boards.")
