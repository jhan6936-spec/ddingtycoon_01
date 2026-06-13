"""Render in-game journal previews from mod GUI textures (382x256, matches DdingtaeScreen)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "mod"
OUT = ASSETS / "previews"

JW, JH = 382, 256
TW, TH = 680, 456
TAB_W, TAB_H = 78, 27
TAB_X, TAB_Y = 4, 43
TAB_GAP = 2
CONTENT_X, CONTENT_W = 112, 248
PANEL_PAD = 8
WEB_W, WEB_H = 96, 22
WEB_X = CONTENT_X + CONTENT_W - WEB_W - 4
WEB_Y = 214

INK = (36, 20, 9)
MUTED = (75, 46, 21)
INK_NIGHT = (243, 231, 200)
MUTED_NIGHT = (201, 168, 130)

TABS = [
    ("goal", "목표"),
    ("resources", "자원"),
    ("crew", "항해일지"),
    ("memo", "선원"),
    ("exploration", "개인설정"),
]

ALCHEMY_ICONS = [
    "aqqutis.png",
    "kraken_frenzy.png",
    "leviathan_feather.png",
    "trench_wave_core.png",
    "silent_deep_elixir.png",
    "blue_dragon_wing.png",
    "aqua_pulse_fragment.png",
    "nautilus_hand.png",
    "abyss_spine.png",
    "extracted_dilution.png",
]

FONT_CANDIDATES = [
    Path(r"C:\Windows\Fonts\malgun.ttf"),
    Path(r"C:\Windows\Fonts\gulim.ttc"),
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in FONT_CANDIDATES:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def scale_texture(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    return img.resize((JW, JH), Image.Resampling.NEAREST)


def paste_widget(canvas: Image.Image, path: Path, x: int, y: int, w: int, h: int) -> None:
    img = Image.open(path).convert("RGBA")
    img = img.resize((w, h), Image.Resampling.NEAREST)
    canvas.alpha_composite(img, (x, y))


def draw_panel(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, night: bool) -> None:
    fill = (138, 85, 43, 140) if night else (230, 201, 148, 165)
    edge = (43, 22, 9, 138) if night else (85, 58, 31, 118)
    draw.rectangle((x, y, x + w, y + h), fill=fill)
    draw.rectangle((x, y, x + w, y + 1), fill=edge)
    draw.rectangle((x, y + h - 1, x + w, y + h), fill=edge)
    draw.rectangle((x, y, x + 1, y + h), fill=edge)
    draw.rectangle((x + w - 1, y, x + w, y + h), fill=edge)


def draw_divider(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, night: bool) -> None:
    color = (43, 22, 9, 102) if night else (85, 58, 31, 68)
    draw.rectangle((x, y, x + w, y + 1), fill=color)


def draw_weblink(draw: ImageDraw.ImageDraw, font: ImageFont.ImageFont, night: bool) -> None:
    outer = (107, 69, 40, 170) if night else (138, 90, 50, 170)
    fill = (74, 50, 24, 190) if night else (223, 200, 140, 190)
    inner = (201, 160, 74, 153) if night else (184, 137, 60, 153)
    ink = INK_NIGHT if night else (43, 22, 9)
    x, y = WEB_X, WEB_Y
    draw.rectangle((x + 2, y + 2, x + WEB_W + 2, y + WEB_H + 2), fill=(0, 0, 0, 85))
    draw.rectangle((x, y, x + WEB_W, y + WEB_H), fill=fill)
    draw.rectangle((x, y, x + WEB_W, y + 1), fill=outer)
    draw.rectangle((x, y + WEB_H - 1, x + WEB_W, y + WEB_H), fill=outer)
    draw.rectangle((x, y, x + 1, y + WEB_H), fill=outer)
    draw.rectangle((x + WEB_W - 1, y, x + WEB_W, y + WEB_H), fill=outer)
    draw.rectangle((x + 1, y + 1, x + WEB_W - 1, y + 2), fill=inner)
    draw.rectangle((x + WEB_W - 4, y + 4, x + WEB_W - 2, y + WEB_H - 4), fill=inner)
    label = "웹 연동"
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((x + (WEB_W - tw) // 2, y + (WEB_H - th) // 2 - 1), label, font=font, fill=ink)


def wrap_text(text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in text:
        trial = current + ch
        bbox = font.getbbox(trial)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = ch
    if current:
        lines.append(current)
    return lines


def draw_page_title(
    draw: ImageDraw.ImageDraw,
    title_font: ImageFont.ImageFont,
    sub_font: ImageFont.ImageFont,
    title: str,
    subtitle: str,
    night: bool,
) -> None:
    ink = INK_NIGHT if night else INK
    muted = MUTED_NIGHT if night else MUTED
    draw.text((CONTENT_X, 58), title, font=title_font, fill=ink)
    draw.text((CONTENT_X, 69), subtitle, font=sub_font, fill=muted)
    draw_divider(draw, CONTENT_X, 82, CONTENT_W, night)


def draw_tabs(canvas: Image.Image, theme: str, active: int) -> None:
    for index, (tab_id, _label) in enumerate(TABS):
        suffix = "_selected" if index == active else ""
        path = ASSETS / "sidebar" / theme / f"tab_{tab_id}{suffix}.png"
        x = TAB_X + (2 if index == active else 0)
        y = TAB_Y + index * (TAB_H + TAB_GAP) + (0 if index == active else 0)
        paste_widget(canvas, path, x, y, TAB_W, TAB_H)

    conn = ASSETS / f"selected_tab_connector_{theme}.png"
    conn_y = TAB_Y + active * (TAB_H + TAB_GAP) + 4
    paste_widget(canvas, conn, 78, conn_y, 22, 21)


def draw_goal_content(canvas: Image.Image, night: bool, title_font, sub_font, body_font) -> None:
    draw = ImageDraw.Draw(canvas)
    ink = INK_NIGHT if night else INK
    muted = MUTED_NIGHT if night else MUTED
    draw_page_title(
        draw,
        title_font,
        sub_font,
        "현재 웹 목표",
        "최종 산물 선택 후 웹 저장 계획 확인",
        night,
    )

    icon_size = 18
    gap = 4
    total = len(ALCHEMY_ICONS) * icon_size + (len(ALCHEMY_ICONS) - 1) * gap
    start_x = CONTENT_X + max(0, (CONTENT_W - total) // 2)
    y = 80
    for index, name in enumerate(ALCHEMY_ICONS):
        icon_x = start_x + index * (icon_size + gap)
        fill = (106, 59, 30, 50) if night else (234, 210, 160, 68)
        ImageDraw.Draw(canvas).rectangle(
            (icon_x, y, icon_x + icon_size, y + icon_size),
            fill=fill,
        )
        paste_widget(canvas, ASSETS / "alchemy" / name, icon_x + 1, y + 1, 16, 16)

    panel_y = 112
    panel_h = 74
    draw_panel(draw, CONTENT_X, panel_y, CONTENT_W, panel_h, night)
    draw.text((CONTENT_X + 9, panel_y + 8), "웹 목표 조회", font=title_font, fill=ink)
    body = (
        "위 최종 산물 아이콘을 누르면 띵타해 웹 계산기에 저장된 목표와 "
        "예상 시간, 전문가 보정, 부족 재료를 항해일지로 펼칩니다."
    )
    line_y = panel_y + 24
    for line in wrap_text(body, body_font, CONTENT_W - 18):
        draw.text((CONTENT_X + 9, line_y), line, font=body_font, fill=muted)
        line_y += 11

    draw_weblink(draw, body_font, night)


def draw_crew_content(canvas: Image.Image, night: bool, title_font, sub_font, body_font) -> None:
    draw = ImageDraw.Draw(canvas)
    ink = INK_NIGHT if night else INK
    muted = MUTED_NIGHT if night else MUTED
    draw_page_title(draw, title_font, sub_font, "선원", "누가 항해 중인가?", night)

    panel_y = 78
    panel_h = 88
    draw_panel(draw, CONTENT_X, panel_y, CONTENT_W, panel_h, night)
    draw.text((CONTENT_X + PANEL_PAD, panel_y + 7), "선장 명부", font=title_font, fill=ink)
    body = (
        "웹 연동 전에는 Discord 닉네임과 연동 상태가 표시되지 않습니다. "
        "오른쪽 아래 [웹 연동] 버튼으로 띵타해 웹 계산기와 연결하세요."
    )
    line_y = panel_y + 24
    for line in wrap_text(body, body_font, CONTENT_W - PANEL_PAD * 2):
        draw.text((CONTENT_X + PANEL_PAD, line_y), line, font=body_font, fill=muted)
        line_y += 11

    draw_weblink(draw, body_font, night)


def render_preview(theme: str, active_tab: int, content: str) -> Image.Image:
    canvas = Image.new("RGBA", (JW, JH), (0, 0, 0, 255))
    base = ASSETS / f"book_base_pages_{theme}.png"
    page = ASSETS / f"main_page_layer_{theme}.png"
    if base.exists():
        canvas.alpha_composite(scale_texture(base))
    canvas.alpha_composite(scale_texture(page))
    draw_tabs(canvas, theme, active_tab)

    title_font = load_font(9)
    sub_font = load_font(8)
    body_font = load_font(8)
    night = theme == "night"

    if content == "goal":
        draw_goal_content(canvas, night, title_font, sub_font, body_font)
    elif content == "crew":
        draw_crew_content(canvas, night, title_font, sub_font, body_font)
    else:
        raise ValueError(content)

    return canvas.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ("goal", 0, "day", "preview_journal_goal_day.png"),
        ("goal", 0, "night", "preview_journal_goal_night.png"),
        ("crew", 3, "day", "preview_journal_crew_day.png"),
        ("crew", 3, "night", "preview_journal_crew_night.png"),
    ]
    for content, active, theme, filename in jobs:
        img = render_preview(theme, active, content)
        path = OUT / filename
        img.save(path, optimize=True)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
