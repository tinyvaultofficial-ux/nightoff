"""
어댑터 v2 — NightOff OutlineItem → 15종 골격 조립기 입력으로 변환 (전체 완성판).
v1(5종)에서 발견된 구멍: 골격 15종인데 SKELETON_MAP이 5종뿐 → 8종 fallback.
v2: NightOff 13종 전부 매핑 + 골격별 변환 + dispatch.
쪼개기는 규칙 경로(검증용). 운영은 LLM 경로(LLM_SPLIT_SPEC) 권장.
"""
import re

SKELETON_MAP = {
    "KPI":"KPI","G1":"G1","G2":"G2","G3":"G3","G4":"G4","G5":"G5","G6":"G6",
    "G7":"G7","G8":"G8","G9":"G9","G10":"G10","G11":"FLOW","G12":"G12",
    "G13":"G13","G14":"G14",
}
VIZ_PATTERN_MAP = {
    "stat":"KPI","quantitative":"KPI","cards3":"G10","two_column":"G2",
    "2col":"G2","comparison":"G2","process":"FLOW","before_after":"G2",
}

def pick_template(item):
    sk = item.get("skeleton_id","")
    if sk in SKELETON_MAP: return SKELETON_MAP[sk]
    vp = item.get("viz_pattern","")
    if vp in VIZ_PATTERN_MAP: return VIZ_PATTERN_MAP[vp]
    return "NONE"

_NUM = re.compile(r"([\d,\.]+\s*(?:만\s*명|억\s*원|만원|개|명|일|건|%|점|위|배|시간|천만원|백만원|년)?)")
def _split_metric(s):
    m = _NUM.search(s)
    if not m: return None
    value = m.group(1).strip()
    label = s[:m.start()].strip(" :·-").strip()
    label = re.sub(r"(은|는|이|가|을|를|의|에서|에|로|으로)$","",label).strip()
    if not label: label = (s[m.end():].strip(" :·-")[:8] or "지표")
    return {"label":label[:8],"value":value[:8]}
def _split_kv(s):
    for sep in (":","-","—","·"):
        if sep in s:
            a,b = s.split(sep,1); return a.strip(), b.strip()
    return s.strip(), ""
def _gsub0(item):
    g = item.get("governing_sub",[]); return g[0] if g else ""
def _common(item, chapter):
    return {"eyebrow":item.get("section",""),"eyebrow_b":item.get("governing_main","")[:20],
            "chapter":chapter,"pagenum":str(item.get("page",""))}

def to_KPI(item):
    cands = item.get("governing_sub",[]) + item.get("key_msgs",[])
    metrics = [m for m in (_split_metric(s) for s in cands) if m]
    d=_common(item,"[ KPI ]"); d.update(template="KPI",head_main=item.get("governing_main",""),metrics=metrics); return d
def to_SEG(item):
    segs=[]
    for s in item.get("key_msgs",[]):
        kw,sub=_split_kv(s); segs.append({"keyword":kw[:7],"subtitle":sub[:24]})
    d=_common(item,"[ 골격 SEG · 분할 ]"); d.update(template="SEG",gov_main=item.get("governing_main",""),segments=segs); return d
def to_G7(item):
    segs=[]
    for s in item.get("key_msgs",[]):
        kw,sub=_split_kv(s); segs.append({"label":kw[:7],"title":kw[:10],"desc":[sub[:14],sub[14:28]] if sub else ""})
    d=_common(item,"[ 골격 G7 · 4분할 명도 ]"); d.update(template="G7",segments=segs); return d
def to_FLOW(item):
    steps=[{"keyword":s.strip()[:12]} for s in item.get("key_msgs",[])]
    d=_common(item,"[ 흐름 ]"); d.update(template="FLOW",head=item.get("governing_main",""),steps=steps); return d
def to_G9(item):
    axes=[]
    for s in item.get("key_msgs",[]):
        kw,sub=_split_kv(s); axes.append({"keyword":kw[:8],"desc":[sub[:12],sub[12:24]] if sub else ""})
    d=_common(item,"[ 골격 G9 · N원형 축 ]"); d.update(template="G9",gov_main=item.get("governing_main",""),gov_sub=_gsub0(item),axes=axes); return d
def to_G1(item):
    cards=[{"comment":s[:40],"name":f"대상 {chr(65+i)}"} for i,s in enumerate(item.get("key_msgs",[]))]
    d=_common(item,"[ 골격 G1 · 인터뷰 카드 ]"); d.update(template="G1",gov_main=item.get("governing_main",""),gov_sub=_gsub0(item),band_title=item.get("governing_main","")[:30],cards=cards); return d
def to_G2(item):
    msgs=item.get("key_msgs",[]); half=(len(msgs)+1)//2
    left=[{"label":_split_kv(s)[0][:8],"desc":_split_kv(s)[1][:30]} for s in msgs[:half]]
    right=[{"label":_split_kv(s)[0][:8],"desc":_split_kv(s)[1][:30]} for s in msgs[half:]]
    d=_common(item,"[ 골격 G2 · 좌우 대비 ]"); d.update(template="G2",gov_main=item.get("governing_main",""),left_title="AS-IS",right_title="TO-BE",left=left,right=right or left); return d
def to_G4(item):
    cats=[]
    for s in item.get("key_msgs",[]):
        kw,sub=_split_kv(s); cats.append({"label":kw[:8],"items":[{"title":kw[:14],"desc":sub[:24]}]})
    d=_common(item,"[ 골격 G4 · 카테고리+항목 ]"); d.update(template="G4",gov_main=item.get("governing_main",""),gov_sub="",categories=cats[:4]); return d
def to_G10(item):
    cards=[]
    for s in item.get("key_msgs",[]):
        kw,sub=_split_kv(s); cards.append({"title":kw[:14],"desc":[sub[:14],sub[14:28]] if sub else ""})
    d=_common(item,"[ 골격 G10 · 카드 그리드 ]"); d.update(template="G10",gov_main=item.get("governing_main",""),gov_sub="",cards=cards[:6]); return d
def to_G12(item):
    teams=[]
    for s in item.get("key_msgs",[]):
        kw,sub=_split_kv(s); teams.append({"name":kw[:12],"task":[sub[:14],sub[14:28]] if sub else ""})
    d=_common(item,"[ 골격 G12 · 조직도 ]"); d.update(template="G12",gov_main=item.get("governing_main",""),gov_sub="",top=item.get("governing_main","")[:14] or "총괄",teams=teams[:4],band=_gsub0(item)); return d
def to_G5(item):
    # key_msgs를 키포인트로. 3개면 좌/중앙/우, 그 이상은 채널 타깃으로.
    msgs=item.get("key_msgs",[])
    kps=msgs[:3]
    # 채널은 고정 3개 틀에 key_msgs 분배(간단: 키포인트만 채우고 채널은 빈 구조)
    channels=[{"name":"온라인","targets":[]},{"name":"오프라인","targets":[]},{"name":"매체·지역","targets":[]}]
    # governing_sub가 있으면 채널 타깃으로
    for i,t in enumerate(item.get("governing_sub",[])[:3]):
        channels[i%3]["targets"].append(t[:18])
    d=_common(item,"[ 골격 G5 · 키포인트+3채널 ]")
    d.update(template="G5",gov_main=item.get("governing_main",""),gov_sub="",
             kp_center=kps[0] if kps else "", kp_left=kps[1] if len(kps)>1 else "",
             kp_right=kps[2] if len(kps)>2 else "", channels=channels)
    return d
def to_G6(item):
    msgs=item.get("key_msgs",[])
    d=_common(item,"[ 골격 G6 · 인용 강조 ]"); d.update(template="G6",faint=item.get("section","")[:14],head=item.get("governing_main","")[:14],body=msgs[:5],quote=_gsub0(item) or (msgs[0] if msgs else "")); return d
def to_G8(item):
    msgs=item.get("key_msgs",[])
    d=_common(item,"[ 골격 G8 · 컨셉 선언 ]"); d.update(template="G8",tag="컨셉",concept=item.get("governing_main","")[:18],slogan=_gsub0(item),line=msgs[0] if msgs else "",body=msgs[1:5]); return d
def to_G13(item):
    msgs=item.get("key_msgs",[])
    d=_common(item,"[ 골격 G13 · 풀배경 인용 ]"); d.update(template="G13",quote=item.get("governing_main",""),source=_gsub0(item),foot=msgs[:2]); return d
def to_G14(item):
    paras=[{"text":s} for s in item.get("key_msgs",[])[:4]]
    d=_common(item,"[ 골격 G14 · 비대칭 2분할 ]"); d.update(template="G14",tag=item.get("section","")[:20],head=item.get("governing_main",""),paragraphs=paras); return d

# G3(인물 2분할)는 사진/프로필 구조 → 텍스트만으론 부적합 → NONE(fallback)
TRANSFORMERS = {"KPI":to_KPI,"SEG":to_SEG,"G7":to_G7,"FLOW":to_FLOW,"G9":to_G9,"G5":to_G5,
    "G1":to_G1,"G2":to_G2,"G4":to_G4,"G10":to_G10,"G12":to_G12,
    "G6":to_G6,"G8":to_G8,"G13":to_G13,"G14":to_G14}

def adapt_item(item):
    tpl=pick_template(item)
    if tpl=="NONE" or tpl not in TRANSFORMERS:
        return {"template":"NONE","_reason":f"skeleton={item.get('skeleton_id','')} 매핑/변환 없음"}
    return TRANSFORMERS[tpl](item)
adapt_item_rule = adapt_item

LLM_SPLIT_SPEC = """[내용 → 필드 변환 규칙]
OutlineItem의 key_msgs(문장)를 선택된 골격 필드로 쪼갠다. 원문에 없는 숫자/단어 금지.
- KPI: {label(8), value(8), delta}  - SEG/G7: {keyword(7), subtitle(24)}
- FLOW/G9: {keyword(12)}  - G1: {comment(40), name}
- G10/G4: {title(14), desc(24)}  - G12: {name(12), task}
결과는 validator 규칙(개수·글자수) 통과해야 함."""

if __name__=="__main__":
    import json
    items=json.load(open("outline_items_15.json",encoding="utf-8"))
    print("=== 어댑터 v2 — 15종 매핑 검증 ===\n")
    ok=0
    for it in items:
        a=adapt_item(it); sk=it.get("skeleton_id","-")
        mark='✅' if a['template']!='NONE' else '→fallback'
        if a['template']!='NONE': ok+=1
        print(f"skeleton={sk:4} → template={a['template']:5} {mark}")
    print(f"\n매핑 성공 {ok}/{len(items)}")
