# Habits: smoking, tobacco, alcohol and their impact on the body

Status: **research in progress** (2026-09-30): **research complete**: H1 (parts 1 + 2), H2, H3, H4, H5 received and verified (see the review sections). Next: design the screen (decisions below), then a verified data file + build. Not built, no decision number yet.

## Owner's ask (2026-09-30)
A separate section for "taboo" habits: cigarettes (and other tobacco) + alcohol per day, combined with what we know about the body (height, weight, age, measurements), showing the impact on the body, updated every day as people log. "Without any metrics there is no reason to add this": the section only makes sense with numbers, rough is fine. Wanted in particular: **% more risk of heart attack and other diseases as cigarettes per day go up**, so people focus on their body and leave these habits.

## Constraints (from the project rules)
- Every number traces to a source (D03 spirit): relative risks, curves, timelines from peer-reviewed / WHO / Surgeon General / Indian government sources. No invented "lung health %" or "body score".
- Shown as rough estimates with ranges ("about +60 %, range 40–80 %"), relative risk never presented as a personal probability.
- Proposed (not decided): opt-in and private (not in Akhada, Wrapped, share cards); harm-reduction tone, no shaming (D23); alcohol read from existing drink logs (D53), tobacco as a new one-tap daily counter (cigarette, bidi, hookah, vape, gutka / khaini); relapse never wipes history. D53 says "no warnings for drinking": this section would change that inside the opt-in area only, so it needs a decision.

## Research
Prompt: `data/research/PROMPT-HABITS.txt` (browser Claude, batches H1–H5: cigarettes dose → harm per disease, bidi / hookah / vape / smokeless, quitting + recovery timeline, alcohol dose → harm, no-lab risk scores such as WHO 2019 CVD charts South Asia / heart age / IDRS). Replies saved as `data/research/habits-h<n>.json` (parts: `habits-h<n>-2.json`), then reviewed here: every source re-opened, models kept only with dose-response + CI.

## H1 review (cigarettes, part 1: `data/research/habits-h1.json`, checked 2026-09-30)
20 models. Every source re-opened (full text unless noted) and **every number matched**; no value was wrong. Part 2 (other cancers, non-fatal conditions: ED, fertility, eyes, teeth, bones, skin, dementia; FEV1; Carter 2015; US SG 2014) still to come (`habits-h1-2.json`).

**Sources checked:** Hackshaw BMJ 2018 (PMC5781309, PMID 29367388; Cancer Research UK funded, no conflicts); Jha NEJM 2008 (WHO-hosted full PDF, PMID 18272886; all CIs are 99 %); Doll BMJ 2004 (BMJ PDF; column mapping of Tables 1 and 3 confirmed); Jackson Addiction 2025 (UCL accepted manuscript); Shaw BMJ 2000 (11 min, 6.5 years, men); Banks BMC Med 2019 (PMC6607519); Inoue-Choi JAMA IM 2017 (PMC5555224, full text, not "abstract only"); Pan Lancet D&E 2015 (PMC4656094); USPSTF 2021 (PMID 33687470); Bjartveit Tob Control 2005 (abstract); Bates Arch Intern Med 2007 (abstract, PMID 17325294).

**Corrections to carry into the verified file:**
- CHD `user_copy` "1 a day ≈ half the extra risk of 20": true for men (CHD 46 %, stroke 41 %), women ≈ a third (CHD 31 %, stroke 34 %). Paper's own summary: "around 40–50 %".
- Cut-down vs quit examples in Hackshaw: 1.06 CHD (Denmark), 1.02 CVD (Norway), 0.92 CHD (Korea); quitters 0.67 CHD, 0.46 CVD, 0.43 CHD. Not all "CVD".
- "Multi-adjusted estimates are higher": not for men's stroke at 20/day (1.56 vs 1.64). Multi-adjusted rows come from 5–11 studies and adjust for cholesterol / BP (on the causal path): a sensitivity range, not the headline.
- Jackson 2025 conflicts are incomplete in the file: first author paid by Freuds+ for this piece; West paid by Everyone Health and advises QNovia (nicotine inhaler), unpaid advisor to Smoke Free; no tobacco / e-cig links. Show the 20-minute figure as a population average with the source named.
- Jha dose-band `user_copy`: the measure is death from **medical causes** at 30–69 (not "dying before 70"). Men only.
- Bates 2007 TB disease: use the abstract's 2.33–2.66 (95 % CI); the 2.29 in a later review isn't in the abstract.
- Pack-years screening: USPSTF "quit within the past 15 years" → `years_since_quit < 15`; PMID 33687470; replace the library-proxy URLs with jamanetwork.com / PMC links.
- PAD caveat: Banks' figure row is I71 "aortic aneurysm and dissection", not AAA only.
- Bjartveit lung cancer, men 1–4/day: 2.79 (0.94–8.28) is not significant (women only, per the authors).
- Forey 2011 COPD meta-analysis: funded by Philip Morris International; exclusion confirmed.

**Filled nulls:**
- Hackshaw Table 1: women CHD 1/5/20 a day 1.57 (1.29–1.91), 1.76 (1.46–2.13), 2.84 (2.21–3.64); stroke 5/day men 1.30 (1.18–1.43), women 1.44 (1.22–1.70). Multi-adjusted CIs in Table 2 (e.g. CHD men 1/day 1.74 (1.50–2.03)). No multi-adjusted 5/day.
- Pan 2015 bands: light < 10/day, moderate 10–19, heavy ≥ 20 ("in most studies"; approximate).
- Jha dose-band CIs: only in the NEJM supplement (not openable); stay null.
- Banks 2019 dose bands, read from the published figures (RR, 95 % CI, vs never; 1–14 / 15–24 / ≥ 25 a day, fatal + non-fatal, Fig 3a): PAD 3.49 (2.81–4.34) / 5.89 (4.94–7.02) / 7.26; heart failure 1.70 (1.36–2.12) / 2.51 (2.06–3.04) / 3.91; heart attack (AMI) 1.88 (1.58–2.24) / 2.55 (2.21–2.95) / 3.34; cerebrovascular 1.52 (1.24–1.87) / 2.20 (1.84–2.63) / 3.22; IHD 1.33 / 1.78 / 2.08; any major CVD 1.28 / 1.70 / 2.12. Deaths only (Fig 3b): IHD death 2.28 / 3.34 / 5.50; CVD death 2.03 / 3.09 / 4.90. Finer CVD-death bands (Fig 4b): 1–3 none (0 deaths), 4–6 1.92, 7–9 2.70, 10–14 2.12, 15–24 3.09, ≥ 25 4.90 (not monotonic: small numbers). Current vs never (Fig 2): aortic aneurysm / dissection 5.92 (4.71–7.45), hypertension 1.34 (1.27–1.42), atherosclerosis 6.60, TIA 1.31.

**What this means for the screen:**
- Enough for a per-disease list that moves with cigarettes a day: heart attack, stroke, heart failure, leg arteries (PAD), lung cancer, COPD, mouth / throat cancers, diabetes, all-cause death, plus TB for India.
- Two sources cover heart attack / stroke differently: Hackshaw (meta-analysis, 1 / 5 / 20 a day, best at low doses, log-linear between 1 and 20 is defensible, 0 → 1 is a jump, nothing above 20) and Banks (one Australian cohort, 1–14 / 15–24 / 25+). Pick one per disease rather than mixing: proposed Hackshaw up to 20 a day, Banks bands only for diseases Hackshaw doesn't cover.
- Heart risk is front-loaded (1 a day already ~40–50 % of the 20-a-day excess), lung cancer and COPD rise roughly in step with the amount: "cutting down helps your lungs; only quitting really helps your heart".
- Almost none of it is validated in Indians except Jha 2008 (all-cause, cause-specific, TB, years lost). Label Western numbers as such.

## H1 part 2 review (`data/research/habits-h1-2.json`, checked 2026-09-30)
19 models: other cancers, sexual / reproductive, eyes, teeth, bones, skin, brain. Numbers match their sources except where listed; 8 papers were closed access and checked from the abstract (+ public supplements where available).

**Corrections:**
- **Cataract:** the file had no citation and a proxy URL that is a commentary (Klein, Arch Ophthalmol 2001). Real source: Christen et al., JAMA 2000;284:713 (PMID 10927779). Its per-10-pack-years RR 1.07 was fitted **among ever smokers**, not vs never smokers (underestimates: current smokers at 35.8 pack-years → 1.27 by the slope, but never vs current is 1/0.64 ≈ 1.56). Use the status / years-since-quit table, not the slope vs never.
- **Liver cancer:** source is Pang et al., J Gastroenterol Hepatol 2015 (PMID 25967392). The file mixes "1.45× (current)" with a "+7.1 % per 10 a day" slope that gives only 1.15 at 20/day: pick one (status table), don't combine in the copy.
- **Erectile dysfunction** (Cao 2014, abstract only): OR 1.14 per +10 cigs/day and 1.15 per +10 years are two separate summaries: never multiply them; reference group not confirmed.
- **Fracture** (Kanis 2005): osteoporotic fracture CI is 1.17–1.43 (the abstract's 1.13–1.28 is the paper's own typo; tables confirm). No "former smoker" group in Kanis; newer FRAX update (Schini et al., Osteoporos Int 2026, PMID 41779026) has current hip HR men 1.78, women 1.64, past smokers men 1.08.
- **Wrinkling** (Ernster 1995): adjusted **odds** ratios (overstate RR); "1.4 years of ageing" is per **10 pack-years**; White Americans only (Asians excluded). Low value for Indian users.
- **Dementia** (Zhong 2015): the 1.34 per 20/day slope rests on only 2 studies. Current 1.30, former 1.01 (no excess) are solid (17–18 studies).
- **Bladder** (van Osch 2016): former-smoker SOR is 1.83 in the abstract but 1.78 (1.53–2.03) in the Results: flag. Risk plateaus at ~15/day; still +50 % 20 years after quitting.
- **Cervical** (ICESCC 2006): 1.6× is squamous only; adenocarcinoma shows no rise (0.89).
- **Colorectal** (Botteri 2020): the paper explains former > current by people quitting when sick, not latency. Full-text dose curve: 1.14 (1.06–1.23) at 20/day, 1.31 (1.12–1.52) at 40; Asia current 1.06 (not significant).
- **Semen quality** (Bundhun 2019): full text is open; "motility" is asthenozoospermia 1.42 (not significant); 3 of 16 studies Indian. Sharma 2016 (Eur Urol) gives count −9.72 ×10⁶/ml, motility −3.5 %, morphology −1.4 %.
- **Oral / pharyngeal** (Possenti 2026): printed quit values (0.51 at 10 y, 0.21 at 18 y) don't match the paper's own equation (0.48, 0.27); use the equation. Includes 15 Indian case-control + 2 Indian cohorts; Asia current RR 2.26 vs 3.58 overall.
- **Stomach** (Rota 2024): includes 12 Indian studies → `south_asian_validated` = partly. Breast (Scala 2023): exact slope exp(0.0057740·cigs), not 1.12^(cigs/20); quitting has no effect.
- **Macular degeneration:** numbers are from EUREYE (Ophthalmology 2007, PMID 17337063), not Chakravarthy 2010; the 2010 meta-analysis gives cohorts RR 1.86 (1.27–2.73) for late AMD (Pfizer-funded: pharma, allowed).
- No tobacco-industry funding in any source checked.

**Curve equations from the supplements** (RR = exp(f(x)), x = cigarettes/day; checked to reproduce the printed values):
- Oral / pharynx (Possenti, Suppl Box 2): 0–10: 0.117997x − 0.000121424x³; 10–31: 0.0000578211x³ − 0.00537736x² + 0.171771x − 0.179245; ≥ 31: 0.00507255x + 1.5433 (≈ 1.78 at 5, 2.88 at 10, 4.80 at 20). Quit: f = −0.0724·years (vs current).
- Stomach (Rota, ESM1 Box 2): 0–10.5: −0.0000463714x³ + 0.041631x; 10.5–30: 0.0000249692x³ − 0.00224723x² + 0.0652269x − 0.0825856; ≥ 30: −0.0021899x + 0.591583 (≈ 1.22 at 5, 1.45 at 10, 1.69 at 20). Quit: f = −0.01442377·years.
- Pancreas (Lugo, Suppl Box 2): 0–10: −0.0000612x³ + 0.0558513x; 10–29.5: 0.0000314x³ − 0.0027755x² + 0.0836061x − 0.0925158; ≥ 29.5: 0.00172953x + 0.712603 (≈ 1.31 at 5, 1.64 at 10, 2.06 at 20, 2.15 at 30). Quit: RCS θ1 −0.05305334, θ2 0.06806407, knots 0 / 5.5 / 24 (≈ 0.65 at 10 y, 0.56 at 20 y).
- Kidney (Liu, Suppl Box 2): 0–11.5: −0.00002795x³ + 0.0337577x; 11.5–30.5: 0.00001692x³ − 0.00154797x² + 0.0515594x − 0.0682397; ≥ 30.5: 0.00434628x + 0.41176 (≈ 1.18 at 5, 1.36 at 10, 1.61 at 20). Quit: f = −0.005834186·years (weak).
- Breast (Scala, eMaterial 2): f = 0.0057740x; quit f = −0.0013354·years (no real effect).
- Colorectal (Botteri, printed points only): 1.14 at 20, 1.31 at 40 (log-linear between is our step).
- Cap at ~40/day for all; below 1/day use the 1-a-day value (no interpolation from 0).

## H2 review (bidi, smokeless, hookah, vape: `data/research/habits-h2.json`, checked 2026-09-30)
10 models; every number matches its source. Closed access (abstract only): INTERHEART (Teo, Lancet 2006), Guha 2014, Bombay cohort IJE 2005. No tobacco / e-cig industry funding anywhere.

**Corrections:**
- Bidi `user_copy`: low-dose range 1.3–1.6 (Jha 1–7/day 1.3; Mumbai 1–5/day 1.62), not 1.3–1.8; Mumbai 1.86 is 6+/day, Jha 2.2 is 8+/day: say "heavier use".
- Smokeless oral cancer (Gupta & Johnson 2014): 2.82 is betel quid **without tobacco**; there is no pooled figure for supari / areca alone and none for "pan masala without tobacco": drop those claims or find their own source. The paper says both 14 and 15 smokeless case-control studies (own inconsistency).
- Paan with tobacco (Guha 2014): outcome is oral **and oropharyngeal** cancer.
- Hookah disease (Waziry 2017): heart disease 1.67 is ONE cross-sectional study (another gave 3.75), not pooled; all-cause death 1.15 is an HR from one Bangladesh cohort; oral cancer 4.17 pools 3 cross-sectional studies. Working PDF URL: AUB bitstream 94517d5b…; PMID 27075769.
- Hookah toxicants (Primack 2016, PMC4716475): per session ≈ 2–3 cigarettes' nicotine (not "~2"), 25× tar, ~11× CO; "45 min" is a lab protocol, not a finding. Numbers = inhaled exposure, not disease risk.
- INTERHEART "+5.6 % per cigarette": no CI and no functional form in the abstract; `1.056^cigs` is our algebra: don't use until the full text is read.
- Vape (NASEM 2018): cancer conclusion is "no human evidence, even on intermediate cancer markers"; add conclusions 10-1, 10-2, 16-1 to `where`.
- GATS-2 URL is dead: use ntcp.mohfw.gov.in/assets/document/surveys-reports-publications/GATS-2-FactSheet.pdf; e-cigarette 0.02 % is from the full GATS-2 report §4.5.
- Gupta & Mehta 2000 (Bull WHO, PMID 10994260, PMC2560806): scielosp 403 → WHO IRIS copy; quotes on p.880.

**Verified additions:**
- Bombay cohort (Gupta, Pednekar, Parkin, Sankaranarayanan, IJE 2005, PMID 16249218; abstract): men all-cause death, cigarettes 1.37 (1.23–1.53), **bidis 1.64 (1.47–1.81)**, dose-response significant; women smokeless 1.25 (1.15–1.35); male smokers TB 2.30, respiratory 2.12, cancers 2.60.
- Pednekar 2011 (Cancer Causes Control, PMC3756904, men, cancer incidence, via page summary twice): bidi 1–5 / 6–10 / 11–15 / ≥ 16 a day 1.85 / 2.11 / 1.95 / 2.29 (all 2.11); cigarette 1.50 / 2.26 / 2.09 / 1.76; smokeless 1.20 overall, no dose trend; oesophagus: smokeless 3.65 (1.59–8.38), bidi 5.46, cigarette 5.72.
- INTERHEART (abstract): current smoker 2.95; bidi only 2.89 (2.11–3.96); chewing only 2.23 (1.41–3.52); smoke + chew 4.09 (2.98–5.61); quit ≤ 3 y 1.87, 20+ y 1.22; second-hand smoke 1.24 (1–7 h/wk) to 1.62 (> 21 h/wk).
- Guha 2014: paan with tobacco 7.74 overall; **women in the Indian subcontinent 14.56 (7.63–27.76)**; 49.5 % of oral cancer in India attributable to paan with tobacco. Dose splines not readable (paywall).
- Gupta & Johnson 2014: smokeless oral cancer 7.46 (case-control), 5.48 (cohort); "risk increases nearly 13 times from 30 to 40 years of chewing" (single studies, no pooled slope).
- GATS-2 (2016–17): any tobacco 28.6 % (men 42.4, women 14.2); smokeless 21.4 %; bidi 7.7 %; cigarette 4.0 %: chewing is India's biggest tobacco habit.

## H3 review (quitting, cutting down: `data/research/habits-h3.json`, checked 2026-09-30)
10 models; every number matches its source. No tobacco-industry funding. No South Asian data (Indian quitting is rare and often follows illness: Jha 2008).

**The "since your last cigarette" timeline (WHO Q&A, 2020) vs its primary sources** (WHO lists 5 references without tying them to bullets):
- 20 min HR / BP drop: no measured quitting study (Mahmud & Feely 2003 measured the rise after ONE cigarette). Show as "the short-term rise from a cigarette wears off", or drop.
- 12 h CO normal: measured (Kambam 1986, COHb 6.55 → 1.06 % after 12 h; Deller 1992 half-life 3–4.5 h by day, up to 8 h at night in men). Not WHO-cited.
- 2–12 weeks circulation / lung function, 1–9 months cough: **no traceable source for the timing**. US SG 1990: lung function +~5 % "within a few months"; symptoms fall (no timeframe); Lung Health Study FEV1 +47 ml in year 1.
- 1 year: US SG 1990 says the **excess** CHD risk halves (WHO's "half a smoker's risk" is looser): copy "your extra heart risk roughly halves".
- 5–15 y stroke, 10 y lung cancer 30–50 % of a smoker's, 15 y CHD like a never smoker: US SG 1990, traceable. Other cancers fall on different timescales (mouth / oesophagus halved by ~5 y, bladder in a few years, pancreas only after ~10 y).
- Life years by quit age (Doll 2004): about 10 / 9 / 6 / at least 3 years at 30 / 40 / 50 / 60 (60 interpolated). Pirie 2013 (PMC3547248, women): quitting at 25–34 avoids ~97 % of the excess death, 35–44 ~90 %, 45–54 at least two-thirds; still-smokers 2.97×.
- Minutes regained (Jackson 2025, PMID 39734064): 10 a day × 20 min → a day by 8 Jan, a week by 20 Feb, a month by 5 Aug, 50 days in a year (checked arithmetic).

**Risk by years since quitting (vs current smokers, heavy smokers):**
- CVD (Duncan, JAMA 2019, PMC6704757, Framingham, ≥ 20 pack-years): < 5 y 0.61, 5–10 y 0.61, 10–15 y 0.54, 15–25 y 0.55, ≥ 25 y 0.45; vs never smokers 1.40 → 0.98 (not significant from ~10–15 y).
- Lung cancer (Tindle, JNCI 2018, PMC6235683, ≥ 21.3 pack-years): < 5 y 0.61, 5–9 y 0.59, 10–14 y 0.39, 15–24 y 0.29, ≥ 25 y 0.19; vs never smokers still 3.85× at 25+ years.
- Diabetes (Pan 2015): continuing smokers vs never 1.47 (same 10 studies; not the 1.37 from 84 studies); quit < 5 y 1.54, 5–9 y 1.18, ≥ 10 y 1.11. The early bump is only **partly** weight gain.

**Cutting down and relapse:**
- Lung cancer, ≥ 50 % reduction (Godtfredsen, JAMA 2005, age 20–93 not 23–93): 0.73 (0.54–0.98) vs continuing heavy smokers; quitters 0.50.
- CVD (Hackshaw 2018 examples): reducers 1.06 CHD / 1.02 CVD / 0.92 CHD vs quitters 0.67 / 0.46 / 0.43: cutting down barely helps the heart.
- Yoo 2022 (Cancer 128:2126, not Ann Oncol; PMID 35298026; Korean, ~94.5 % men, 40+): reducers ≥ 50 % all cancer 0.96, lung 0.83; quitters 0.94 / 0.79; reducers who then quit 0.66 lung vs **those who stayed reduced**; increasers lung 1.15. Relapse (vs staying quit): back to the full amount → lung cancer 1.38, smoking-related 1.23, all cancer 1.15; the file's 1.19 / 1.48 are only for relapse at ≤ 50 % of the old amount. 36.5 % relapsed by the third screening.

## H4 review (alcohol: `data/research/habits-h4.json`, checked 2026-09-30)
11 models; no wrong values. All sources re-read in full text (PMC / official PDFs). No alcohol-industry funding anywhere.

**Units:** WHO standard drink = 10 g (GHO; AUDIT manual). **India has an official definition too:** ICMR-NCDIR National NCD Monitoring Survey 2017–18: one standard drink = 10 g pure alcohol; heavy episodic = ≥ 6 drinks (60 g) on one occasion in the past 30 days (same as WHO, adults 15+, GHO IMR 458). Several papers use 12 g drinks (Roerecke BP + cirrhosis, Jiang AF): convert. kcal = 7 per g (EU 1169/2011 Annex XIV; FAO FNP 77 §4.4); ethanol 0.79 g/ml (WHO AUDIT manual App. B). Log and compute in grams.

**Corrections:**
- Wood 2018 (Lancet, PMC5899998): "authors say the MI benefit is outweighed" is not in the paper: drop. HRs are per 100 g/week between two intakes among current drinkers (non-drinkers excluded): label `hr_vs_reference_intake`, not "vs 0 g". "100 g ≈ 10 drinks" only with 10 g drinks (= 12.5 UK units).
- AF (Jiang 2022, PMC9561500): drink = 12 g; +6 %/drink overall, men +8 % linear, **women J-shaped** (risk above 1.4 drinks/day): use the slope for men only.
- Cirrhosis (Roerecke 2019, PMC6776700): drink = 12 g; the big RRs come from cohorts of cirrhosis **deaths**; morbidity (2 Italian case-control) is lower. Filled: women 1 drink/day 1.64 (1.07–2.51), 2 drinks 4.33; men 1 drink 0.91 (ns), 2 drinks 1.97 (ns).
- Bagnardi "Table 2" → the light / moderate / heavy RRs are in **Figure 2** (below). No per-10 g slopes for mouth / oesophagus exist in the paper (curves only): don't read them off a graph.
- AUDIT: use the WHO manual (WHO/MSD/MSB/01.6a, iris.who.int/handle/10665/67205), not the insurer PDF. "92 % / 94 %" is Saunders 1993 (Addiction, PMID 8329970). The WHO manual defines no AUDIT-C cut-offs.
- WHO Europe 2023: the paper (Anderson **BO** et al., Lancet Public Health 2023;8:e6, PMC9831798) says "no safe amount of alcohol consumption for cancers and health can be established"; "No level of alcohol consumption is safe for our health" is the WHO/Europe press-release headline (4 Jan 2023).

**Verified values to use:**
- Life expectancy at 40 (Wood, US death rates, 19 high-income countries): vs > 0–100 g/week, 100–200 g ≈ −6 months, 200–350 g ≈ −1–2 years, > 350 g ≈ −4–5 years. Per 100 g/week: stroke 1.14, heart failure 1.09, fatal hypertensive disease 1.24, fatal aortic aneurysm 1.15, CHD (excl. MI) 1.06, MI 0.94.
- Lowest-risk level, **South Asia** (GBD 2020 appendix 2 Table S1, drinks of 10 g / day): men 15–19 0.006, 20–24 0.04, 25–29 0.09, 30–34 0.28, 35–39 0.37, 40–44 0.50, 50–54 0.65, 60–64 0.71, 80+ 0.81; women 15–19 0.10 → 80+ 0.73. "No net harm" level men 15–29 ≤ 0.17 drinks / day. India 2020: 79.9 M men aged 15–39 (25.7 %) drank above it.
- BP when cutting down (Roerecke 2017, 12 g drinks): ≥ 6 drinks/day → −5.5 / −3.97 mmHg; 4–5 → −3.0 / −1.9; 3 → −1.2 / −1.1; ≤ 2 → no change; ≈ −0.9 mmHg systolic per daily drink of baseline intake. Women: 3 trials only.
- Cancers (Bagnardi 2015 Fig 2; light ≤ 12.5 g/day, moderate ≤ 50, heavy > 50): oral / pharynx 1.13 / 1.83 / 5.13; oesophageal SCC 1.26 / 2.23 / 4.95; larynx 0.87 / 1.44 / 2.65; colorectum 0.99 / 1.17 / 1.44; liver 1.00 / 1.08 / 2.07; breast 1.04 / 1.23 / 1.61; stomach, pancreas, lung, prostate ≈ 1.1–1.2 heavy only. **Asian studies:** light drinking already raises oral 1.33, oesophageal SCC 1.54 (ALDH2 variants, 28–45 % of people in Asia).
- Breast (Hamajima 2002, PMC2562507): +7.1 % (5.5–8.7) per 10 g/day.
- AUDIT (WHO): 10 items; 0–7 / 8–15 / 16–19 / 20–40 zones; 7 for women and men over 65. India (Goa men): Nayak 2009 recommends AUDIT 9–10 and AUDIT-C 5–6 for alcohol use disorders; Endsley 2017: 6–12 abuse, ≥ 13 dependence (WHO's 16 / 20 miss most cases here). These are disorder cut-offs, not replacements for the WHO hazardous-drinking zone (8).

## H5 review (combined scores: `data/research/habits-h5.json`, checked 2026-09-30)
8 models; values correct, several completed from appendices. Full text read for all main sources.

**1. WHO 2019 CVD risk chart, non-lab, South Asia → `data/research/who-cvd-south-asia-nonlab.json`** (the best "body condition" number we have)
- 10-year risk of fatal / non-fatal heart attack or stroke from **sex, current smoker, age band (40–74), systolic BP band, BMI band**; 700 cells transcribed from the official chart (Lancet Glob Health 2019 appendix 2 p37 = WHO HEARTS 2020 Annex 3 p62), checked against the page image and the HEARTS copy, monotonic in every direction. Colours < 5 / 5–10 / 10–20 / 20–30 / ≥ 30 %.
- The equation route doesn't work: South Asia recalibration factors and non-lab baseline survivals are not published. Use the chart cells.
- Caveats: derived mostly in European / US cohorts, recalibrated to South Asia with GBD incidence; no South Asian validation cohort. Non-lab underestimates risk with diabetes (they need the lab chart). WHO positions it for screening / education; ≥ 10 % → see a doctor. Needs a blood-pressure entry (home monitor) and height + weight.
- Smoker vs non-smoker cells give an honest "if you quit" comparison (e.g. man 50–54, SBP 140–159, BMI 25–29: 12 % → 7 %).
- Source: PMC7025029, PMID 31488387, doi 10.1016/S2214-109X(19)30318-3.

**2. INTERHEART non-laboratory risk score** (heart disease, 0–48 points; no blood test, no BP reading)
- Points (Joseph 2018 Heart supplement Table 1 = McGorrian 2011 supplement; also SPICES 2023 Table S1): man ≥ 55 / woman ≥ 65: 2; smoking never 0, former (> 12 months) 2, current 1–5 / 6–10 / 11–15 / 16–20 / > 20 a day: 2 / 4 / 6 / 7 / 11; second-hand smoke ≥ 1 h/week 2; diabetes 6; high BP 5; parent had a heart attack 4; waist-to-hip < 0.873: 0, 0.873–0.963: 2, ≥ 0.964: 4; stress (several periods / permanent) 3; depressed ≥ 2 weeks in the past year 3; salty food ≥ 1/day 1; fried / fast food ≥ 3/week 1; fruit < 1/day 1; vegetables < 1/day 1; meat ≥ 2/day 2; sedentary / mild leisure 2.
- Points → risk, South Asia (Joseph P et al., Heart 2018;104:581, PMC5861396, PURE, 12,130 South Asians): PI = −1.45 + 0.2875 × (points / 2); 7-year CVD risk = 1 / (1 + exp(−(−3.03 + 0.75 × PI))). Checked: 0 points → 1.6 %, 16 → 8.4 % (their Supp Table 4). c-statistic in South Asia 0.67.
- "Low / moderate / high" bands (0–9 / 10–15 / ≥ 16) only in secondary papers: show the %, not a band. Funding: INTERHEART / PURE had unrestricted pharma grants (not tobacco).
- Why it fits Prana: smoking points move with the log, diet / activity items can come from logs, waist-to-hip from measurements (needs a hip entry, exists in D39).

**3. Indian Diabetes Risk Score (Mohan 2005, JAPI, PMID 16334618; 4-level activity form from INDIAB-15, PMC10438401)**: age < 35: 0, 35–49: 20, ≥ 50: 30; waist (women < 80 / 80–89 / ≥ 90, men < 90 / 90–99 / ≥ 100): 0 / 10 / 20; activity vigorous 0, moderate 10, mild 20, none + sedentary 30; family history none 0, one parent 10, both 20. < 30 low, 30–50 moderate, ≥ 60 high. ≥ 60: sensitivity 72.5 %, specificity 60.1 % (CURES, n 2,207); national INDIAB-15 (n 113,043): 60.2 % / 68.8 %, AUC ~0.70; 8-year follow-up: 27.8 % of high scorers got diabetes vs 5.6 % low. Screening only; sensitivity varies 26–95 % across Indian studies.

**4. BMI and waist for Indians**
- WHO 2004 (Lancet, PMID 14726171): Asian action points 23, 27.5, 32.5, 37.5; < 18.5 underweight, 18.5–23 acceptable, 23–27.5 increased risk, ≥ 27.5 high risk.
- Indian consensus 2009 (Misra, JAPI, PMID 19582986): normal 18.0–22.9, overweight 23–24.9, obese ≥ 25; waist action level 2: men 90, women 80 cm (level 1: 78 / 72).
- India 2025 (Misra et al., Diabetes Metab Syndr 19:102989, PMID 39814628; Delphi, 118 experts): stage 1 = BMI > 23, no symptoms, no obesity disease; stage 2 = BMI > 23 + (waist ≥ 90 / 80 cm or waist-to-height > 0.5) + symptoms or disease. BMI grades 18.5–22.99 normal, 23–24.9 I, 25–27.5 II, 27.6–32.4 III, ≥ 32.5 IV. Edge cases: BMI exactly 23; comorbidity with normal waist fits neither stage.
- **Waist method differs:** Indian consensus = just above the iliac crest at end of expiration; Prana's measurements (D39) use the WHO midpoint method. Decide which one the Habits / risk screens ask for.

**5. Weight after quitting** (Aubin, BMJ 2012, PMC3393785; untreated quitters): +1.1 kg at 1 month, 2.3 at 2, 2.9 at 3, 4.2 at 6, 4.7 kg at 12 months (≈ 1 kg a month for 3 months); at 12 months 16 % lost weight, 37 % gained < 5 kg, 34 % 5–10 kg, 13 % > 10 kg. Heart benefit holds after weight gain (Clair, JAMA 2013, PMC3791107, Framingham): recent quitters HR 0.49 (0.24–0.99) after adjusting for weight change, long-term 0.46 vs smokers; clearly shown for gains of 0–5 kg (not significant for ≥ 5 kg: few events). No South Asian data. **Prana's angle:** quitting + calorie tracking can cap the gain.

**6. Tobacco × alcohol** (Hashibe, INHANCE, CEBP 2009, PMC3051410; India excluded): head & neck cancer vs never both: alcohol only 1.06, tobacco only 2.37, both 5.73 (oral 4.78). By dose: 1–20 tobacco/day + ≥ 3 drinks/day 9.92 (6.36–15.46); > 20 + ≥ 3 drinks 14.23 (8.30–24.40). Tobacco units include chews / snuff. India (Petti 2013, PLoS One, PMC3832519, oral cancer, Indian subgroup): smoking + drinking 5.81, drinking + paan 5.05, all three 46.06 (38.09–55.70); betel quid not split by tobacco.

## Research status and verified data (2026-09-30)
All batches H1–H5 received and verified against the original papers (~90 models, ~60 sources; every source re-opened, no invented numbers, no tobacco / alcohol-industry funding). Raw replies stay in `data/research/habits-*.json` as browser Claude wrote them; the corrections and additions above are what a verified data file (to be written when the screen is designed) must use. Official chart: `data/research/who-cvd-south-asia-nonlab.json`.

## Open (after the research)
Where it lives (Progress section vs own page), synced vs device-only (sensitive health data, DPDP; admin visibility), whether to add a blood pressure entry (needed by the WHO CVD chart), alcohol reference line.
