// Single source of truth for "what can Chappie do?". Exposed via a tool so
// the system prompt stays slim — the LLM only pulls this list when the user
// actually asks. Keep entries punchy, one or two examples each, in the
// user's voice (not API parlance). When you add a new tool, also add a
// matching entry here so users can discover it just by asking.

use crate::i18n::Lang;

pub fn capabilities_text() -> String {
    match crate::i18n::current() {
        Lang::Ja => capabilities_ja(),
        Lang::En => capabilities_en(),
        Lang::Es => capabilities_es(),
        Lang::Fr => capabilities_fr(),
        Lang::De => capabilities_de(),
        Lang::Zh => capabilities_zh(),
        Lang::Pt => capabilities_pt(),
        Lang::Ko => capabilities_ko(),
        Lang::It => capabilities_it(),
    }
}

fn capabilities_pt() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("Conversa", &["Bate-papo, conselhos, perguntas, leitura de sorte, piadas, escrita criativa (histórias, letras, nomes), tradução, resumo (lembra do recente)"]),
        (
            "Tempo",
            &[
                "Que horas são? / Que dia é hoje?",
                "Põe um timer de 3 minutos (vários ao mesmo tempo OK)",
                "Me acorda amanhã às 7, lembra de tomar o remédio às 20h (sobrevivem ao reinício)",
            ],
        ),
        (
            "Agenda",
            &[
                "O que tenho hoje?",
                "Minha agenda de amanhã",
                "Qual é o próximo?",
            ],
        ),
        ("Clima", &["Clima aqui, vai chover amanhã?, clima em São Paulo"]),
        (
            "Qualidade do ar / poeira",
            &[
                "Como está o ar hoje?, e o PM2.5?, tem poeira no ar?, o UV está forte?",
                "PM2.5, PM10, poeira e índice UV, aqui ou em um lugar indicado (sem pólen)",
            ],
        ),
        (
            "O que aconteceu hoje",
            &[
                "O que aconteceu hoje?, o que houve em N de N?",
                "Eventos históricos do dia, com o ano (Wikipedia; cai para inglês se faltar)",
            ],
        ),
        (
            "Notícias",
            &[
                "Últimas notícias (NHK principais)",
                "Notícias de tecnologia (Hacker News), notícias do mundo (BBC)",
            ],
        ),
        (
            "Wikipédia",
            &["O que é ___?, me fala sobre ___", "Pega até o que veio depois do corte de conhecimento do modelo"],
        ),
        (
            "Terremotos",
            &["Sismos recentes?, acabei de sentir um tremor?", "Lista mais recente da JMA — epicentro, magnitude, intensidade"],
        ),
        (
            "Câmbio",
            &["1 dólar em iene?, e o euro?", "Quanto são 100 dólares em ienes? (amount converte na hora)"],
        ),
        (
            "Ações e índices",
            &["Cotação da Apple, S&P hoje, Nikkei?", "Stooq (US ~15min atrasado, sem chave, não para trading)"],
        ),
        (
            "Conversão de unidades",
            &["70°F em Celsius?, 5 milhas em km?, 100 libras em kg?", "Temperatura / comprimento / peso / volume / velocidade / área"],
        ),
        (
            "Sol / lua",
            &["Que horas o sol se põe hoje?, e o nascer?", "Hoje é lua cheia? (idade da lua + rótulo)"],
        ),
        (
            "Resumo de página",
            &["Lê a URL da área de transferência, resume esse link", "Pega só o corpo e resume em 2–4 frases"],
        ),
        (
            "Web",
            &[
                "Abre o YouTube, abre o site da Apple",
                "Pesquisa ___ no Google (no navegador padrão)",
            ],
        ),
        (
            "Apps e pastas",
            &[
                "Abre o Slack, abre o Spotify, abre o Notas",
                "Abre Downloads, abre Aplicativos, abre o Lixo",
            ],
        ),
        ("Volume", &["Volume 30, abaixa um pouco, mudo"]),
        (
            "Música",
            &[
                "Próxima, pausa (controla Spotify ou Apple Music aberto)",
                "O que está tocando? (lê título e artista)",
            ],
        ),
        (
            "Papel de parede",
            &[
                "Muda o papel de parede para floresta, estética, céu noturno",
                "Cada monitor recebe uma foto diferente (via Pixabay)",
                "Põe a imagem do dia da Wikipédia como papel de parede",
                "Põe uma obra de arte como papel de parede (Art Institute of Chicago)",
            ],
        ),
        (
            "Relógio mundial",
            &[
                "Que horas são em Londres?, que horas são em Nova York?",
                "Hora atual de qualquer cidade ou país (a local é só \"que horas são?\")",
            ],
        ),
        (
            "Aurora / clima espacial",
            &[
                "Dá pra ver aurora hoje?, tem tempestade geomagnética?",
                "Visibilidade pelo índice Kp da NOAA e sua latitude (raro em latitudes médias)",
            ],
        ),
        (
            "Pontos próximos",
            &[
                "Tem algo interessante por perto?, o que tem aqui perto?",
                "Artigos da Wikipédia perto de você, com distância (raio ajustável)",
            ],
        ),
        (
            "Aviões sobre você",
            &[
                "Que avião está passando?, tem avião lá em cima?",
                "Aeronaves acima de você com prefixo, país de origem e altitude (OpenSky)",
            ],
        ),
        (
            "ISS (estação espacial)",
            &[
                "Onde está a estação espacial agora?, cadê a ISS?",
                "Posição atual da ISS (oceano/região aproximada), altitude e velocidade",
            ],
        ),
        (
            "Pokémon",
            &[
                "Quais os atributos do Pikachu?, qual o tipo do Charizard?",
                "Atributos-base, tipos e habilidades (PokéAPI)",
            ],
        ),
        (
            "Fórmula 1",
            &[
                "Quando é a próxima corrida de F1?, resultado da última?, classificação?",
                "Próxima corrida, último pódio, classificação atual (Jolpica)",
            ],
        ),
        (
            "Anime",
            &[
                "Quantos episódios de ___?, nota de ___?, sobre o que é?",
                "Episódios, status, nota, gêneros e sinopse (MyAnimeList)",
            ],
        ),
        (
            "Feriados",
            &[
                "Quando é o próximo feriado?, tem feriado mês que vem?",
                "Lista os feriados do ano (qualquer país, 100+)",
            ],
        ),
        (
            "Ondas / surf",
            &[
                "Como estão as ondas hoje?, dá pra surfar?",
                "Altura, período e direção das ondas no litoral (não no interior)",
            ],
        ),
        (
            "Área de transferência",
            &["Lê a área de transferência", "Escreve ___ e copia"],
        ),
        (
            "Capturas de tela",
            &[
                "Tira um screenshot (seleção → área de transferência)",
                "Captura a tela toda e salva na Mesa",
            ],
        ),
        (
            "Notas",
            &["Anota isso: ___", "Acha as notas sobre ___, lê as notas recentes"],
        ),
        (
            "Memória de longo prazo",
            &[
                "Lembra de você (nome, família, preferências, profissão)",
                "\"Lembra que ___\", \"O que você sabe sobre mim?\", \"Esquece isso\"",
            ],
        ),
        (
            "Status do Mac",
            &["Quanta bateria?, quanto falta para carregar?"],
        ),
        (
            "Bloquear e dormir",
            &[
                "Bloqueia a tela, desliga a tela, dorme",
                "Não deixa dormir, mantém acordado por 30 minutos, libera",
            ],
        ),
        (
            "Encerrar",
            &["Diz 'até mais' ou 'obrigado' para voltar ao modo de espera"],
        ),
    ];
    render(categories)
}

fn capabilities_ko() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("수다", &["잡담, 상담, 질문 답변, 운세, 농담, 창작 (이야기·가사·이름 짓기), 번역, 요약 (최근 흐름 기억)"]),
        (
            "시간",
            &[
                "지금 몇 시? / 오늘 날짜",
                "3분 타이머, 5분 타이머 (동시에 여러 개 OK)",
                "내일 7시에 깨워줘, 8시에 약 먹으라고 알려줘 (재시작 후에도 유지)",
            ],
        ),
        (
            "캘린더",
            &[
                "오늘 일정은?",
                "내일 스케줄 알려줘",
                "다음 일정은?",
            ],
        ),
        ("날씨", &["여기 날씨, 내일 우산 필요해?, 서울 날씨"]),
        (
            "공기질 · 황사",
            &[
                "오늘 공기 어때?, PM2.5는?, 황사 왔어?, 자외선 강해?",
                "PM2.5·PM10·황사·UV 지수를 현재지나 지정 지역으로 (꽃가루는 미지원)",
            ],
        ),
        (
            "오늘은 무슨 날",
            &[
                "오늘은 무슨 날?, N월 N일엔 무슨 일이 있었어?",
                "그날의 역사적 사건을 연도와 함께 (위키백과, 없으면 영어로)",
            ],
        ),
        (
            "뉴스",
            &[
                "최신 뉴스 알려줘 (NHK 주요 뉴스)",
                "테크 뉴스 (Hacker News), 해외 뉴스 (BBC)",
            ],
        ),
        (
            "위키백과",
            &["○○가 뭐야?, ○○에 대해 알려줘", "모델 학습 컷오프 이후의 인물·사건도 잡힘"],
        ),
        (
            "지진 정보",
            &["최근 지진?, 방금 흔들렸어?", "JMA 최신 지진 목록 — 진원·규모·최대 진도"],
        ),
        (
            "환율",
            &["1달러 얼마야?, 유로는?", "100달러는 얼마야? (amount 지정 시 즉시 환산)"],
        ),
        (
            "주식·지수",
            &["애플 주가, 오늘 S&P, 닛케이는?", "Stooq (미국주 약 15분 지연, 무료, 매매용 아님)"],
        ),
        (
            "단위 환산",
            &["화씨 70도는 몇 도?, 5마일은 몇 km?, 100파운드는 몇 kg?", "온도 / 길이 / 무게 / 부피 / 속도 / 면적"],
        ),
        (
            "일출 / 일몰 / 달",
            &["오늘 일몰 몇 시?, 일출은?", "오늘 밤 보름달이야? (월령 + 라벨)"],
        ),
        (
            "페이지 요약",
            &["클립보드 URL 읽어줘, 이 링크 요약해줘", "본문만 뽑아 2–4문장으로 요약"],
        ),
        (
            "웹",
            &[
                "유튜브 열어, 애플 사이트 열어",
                "구글에서 ___ 검색해 (기본 브라우저로)",
            ],
        ),
        (
            "앱과 폴더",
            &[
                "Slack 열어, Spotify 열어, 메모 열어",
                "다운로드 폴더 열어, 응용 프로그램 열어, 휴지통 열어",
            ],
        ),
        ("볼륨", &["볼륨 30으로, 조금 낮춰, 음소거"]),
        (
            "음악",
            &[
                "다음 곡, 정지 (실행 중인 Spotify / Apple Music 제어)",
                "지금 무슨 곡? (곡명과 아티스트 읽어줌)",
            ],
        ),
        (
            "배경화면",
            &[
                "배경화면을 숲으로, 밤하늘로, 감성적인 배경화면으로",
                "모니터마다 다른 사진 (Pixabay 사용)",
                "오늘의 위키백과 사진을 배경화면으로",
                "명화를 배경화면으로 (시카고 미술관 소장품)",
            ],
        ),
        (
            "세계 시계",
            &[
                "런던 지금 몇 시?, 뉴욕은 몇 시?",
                "도시·국가의 현재 시각 (현재지는 '지금 몇 시?')",
            ],
        ),
        (
            "오로라 · 우주날씨",
            &[
                "오늘 밤 오로라 볼 수 있어?, 자기폭풍 왔어?",
                "NOAA Kp 지수와 위도로 가시성 판단 (중위도에선 거의 불가)",
            ],
        ),
        (
            "근처 명소",
            &[
                "근처에 뭐 있어?, 이 근처 명소 알려줘",
                "현재지 근처 위키백과 항목을 거리와 함께 (반경 지정 가능)",
            ],
        ),
        (
            "머리 위 비행기",
            &[
                "지금 위에 지나가는 비행기 뭐야?, 상공에 비행기 있어?",
                "현재지 상공의 항공기를 편명·출발국·고도와 함께 (OpenSky)",
            ],
        ),
        (
            "ISS (우주정거장)",
            &[
                "우주정거장 지금 어디?, ISS 어디 있어?",
                "ISS의 현재 위치(대략적 해역·지역)·고도·속도",
            ],
        ),
        (
            "포켓몬",
            &[
                "피카츄 종족값은?, 리자몽 타입은?",
                "종족값·타입·특성 (PokéAPI)",
            ],
        ),
        (
            "F1",
            &[
                "다음 F1 언제?, 지난 경기 결과는?, 드라이버 순위는?",
                "다음 경기 일정·지난 포디움·현재 순위 (Jolpica)",
            ],
        ),
        (
            "애니메이션",
            &[
                "___ 몇 화까지 나왔어?, ___ 평점은?, 어떤 내용이야?",
                "화수·방영 상태·점수·장르·줄거리 (MyAnimeList)",
            ],
        ),
        (
            "공휴일",
            &[
                "다음 공휴일 언제?, 다음 달 공휴일 있어?",
                "올해 공휴일 알려줘 (국가 지정 가능, 100여 개국)",
            ],
        ),
        (
            "파도 · 서핑",
            &[
                "오늘 파도 어때?, 서핑할 만해?",
                "해안의 파고·주기·방향 (내륙은 미지원)",
            ],
        ),
        (
            "클립보드",
            &["클립보드 읽어줘", "___ 적어서 클립보드에 복사해 줘"],
        ),
        (
            "스크린샷",
            &[
                "스크린샷 찍어 (영역 선택 → 클립보드)",
                "전체 화면 캡처해서 데스크탑에 저장해",
            ],
        ),
        (
            "메모",
            &["이거 메모해 줘: ___", "___ 관련 메모 찾아줘, 최근 메모 읽어줘"],
        ),
        (
            "장기 기억",
            &[
                "당신을 기억해요 (이름, 가족, 취향, 직업)",
                "\"___ 기억해 줘\", \"나에 대해 뭐 알고 있어?\", \"그거 잊어\"",
            ],
        ),
        ("Mac 상태", &["배터리 몇 %?, 충전 얼마나 남았어?"]),
        (
            "잠금과 절전",
            &[
                "화면 잠금, 디스플레이 끄기, 절전 모드",
                "절전 안 되게 해, 30분 깨어 있게 해, 해제",
            ],
        ),
        (
            "종료",
            &["'또 봐' 또는 '고마워'라고 하면 대기 모드로 돌아감"],
        ),
    ];
    render(categories)
}

fn capabilities_it() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("Chiacchiere", &["Conversazione, consigli, domande, oroscopo / lettura della fortuna, battute, scrittura creativa (storie, testi, nomi), traduzione, riassunti (ricorda il recente)"]),
        (
            "Tempo",
            &[
                "Che ore sono? / Che data è oggi?",
                "Fai un timer di 3 minuti (più timer insieme va bene)",
                "Svegliami domani alle 7, ricordami di prendere la medicina alle 20 (sopravvive al riavvio)",
            ],
        ),
        (
            "Calendario",
            &[
                "Cos'ho in agenda oggi?",
                "L'agenda di domani",
                "Qual è il prossimo?",
            ],
        ),
        ("Meteo", &["Meteo qui, devo prendere l'ombrello domani?, meteo a Roma"]),
        (
            "Qualità dell'aria / polvere",
            &[
                "Com'è l'aria oggi?, e il PM2.5?, c'è polvere?, l'UV è alto?",
                "PM2.5, PM10, polvere e indice UV, qui o in un luogo indicato (no pollini)",
            ],
        ),
        (
            "Cosa è successo oggi",
            &[
                "Cosa è successo oggi?, cosa accadde il N/N?",
                "Eventi storici del giorno, con l'anno (Wikipedia; ripiega sull'inglese)",
            ],
        ),
        (
            "Notizie",
            &[
                "Ultime notizie (NHK principali)",
                "Notizie tech (Hacker News), notizie dal mondo (BBC)",
            ],
        ),
        (
            "Wikipedia",
            &["Cos'è ___?, parlami di ___", "Coglie anche ciò che esce dopo il cutoff del modello"],
        ),
        (
            "Terremoti",
            &["Terremoti recenti?, ho appena sentito una scossa?", "Lista JMA più recente — epicentro, magnitudo, intensità"],
        ),
        (
            "Cambio",
            &["1 dollaro in yen?, e l'euro?", "Quanti yen sono 100 dollari? (amount converte al volo)"],
        ),
        (
            "Azioni e indici",
            &["Quotazione Apple, S&P oggi, Nikkei?", "Stooq (azioni US ~15min ritardo, senza chiave, non per trading)"],
        ),
        (
            "Conversione unità",
            &["70°F in Celsius?, 5 miglia in km?, 100 libbre in kg?", "Temperatura / lunghezza / peso / volume / velocità / area"],
        ),
        (
            "Sole / luna",
            &["A che ora tramonta oggi?, e l'alba?", "Stanotte c'è la luna piena? (età lunare + etichetta)"],
        ),
        (
            "Riassunto pagina",
            &["Leggi l'URL negli appunti, riassumi quel link", "Estrae solo il corpo e riassume in 2–4 frasi"],
        ),
        (
            "Web",
            &[
                "Apri YouTube, apri il sito di Apple",
                "Cerca ___ su Google (nel browser predefinito)",
            ],
        ),
        (
            "App e cartelle",
            &[
                "Apri Slack, apri Spotify, apri Note",
                "Apri Download, apri Applicazioni, apri il Cestino",
            ],
        ),
        ("Volume", &["Metti il volume a 30, abbassa un po', muto"]),
        (
            "Musica",
            &[
                "Prossimo brano, pausa (controlla Spotify o Apple Music aperto)",
                "Cosa sta suonando? (legge titolo e artista)",
            ],
        ),
        (
            "Sfondo",
            &[
                "Cambia lo sfondo in foresta, mettilo estetico, cielo stellato",
                "Ogni monitor riceve una foto diversa (tramite Pixabay)",
                "Metti la foto del giorno di Wikipedia come sfondo",
                "Metti un'opera d'arte come sfondo (Art Institute of Chicago)",
            ],
        ),
        (
            "Orologio mondiale",
            &[
                "Che ore sono a Londra?, che ore sono a New York?",
                "Ora attuale di qualsiasi città o paese (l'ora locale è solo \"che ore sono?\")",
            ],
        ),
        (
            "Aurora / meteo spaziale",
            &[
                "Stanotte si vede l'aurora?, c'è una tempesta geomagnetica?",
                "Visibilità dall'indice Kp della NOAA e dalla tua latitudine (rara alle medie latitudini)",
            ],
        ),
        (
            "Luoghi vicini",
            &[
                "C'è qualcosa di interessante qui vicino?, cosa c'è qui intorno?",
                "Articoli di Wikipedia vicino a te, con la distanza (raggio regolabile)",
            ],
        ),
        (
            "Aerei sopra di te",
            &[
                "Che aereo sta passando?, ci sono aerei sopra?",
                "Aerei sopra di te con sigla, paese di origine e quota (OpenSky)",
            ],
        ),
        (
            "ISS (stazione spaziale)",
            &[
                "Dov'è la stazione spaziale adesso?, dov'è la ISS?",
                "Posizione attuale della ISS (oceano/regione approssimativa), quota e velocità",
            ],
        ),
        (
            "Pokémon",
            &[
                "Quali sono le statistiche base di Pikachu?, di che tipo è Charizard?",
                "Statistiche base, tipi e abilità (PokéAPI)",
            ],
        ),
        (
            "Formula 1",
            &[
                "Quando è la prossima gara di F1?, risultati dell'ultima?, classifica piloti?",
                "Prossima gara, ultimo podio, classifica attuale (Jolpica)",
            ],
        ),
        (
            "Anime",
            &[
                "Quanti episodi di ___?, voto di ___?, di cosa parla?",
                "Episodi, stato, voto, generi e trama (MyAnimeList)",
            ],
        ),
        (
            "Festività",
            &[
                "Qual è la prossima festività?, ci sono feste il mese prossimo?",
                "Elenca le feste dell'anno (qualsiasi paese, 100+)",
            ],
        ),
        (
            "Onde / surf",
            &[
                "Com'è il mare oggi?, si può surfare?",
                "Altezza, periodo e direzione delle onde sulla costa (non nell'entroterra)",
            ],
        ),
        (
            "Appunti",
            &["Leggi gli appunti", "Scrivi ___ e copialo"],
        ),
        (
            "Schermate",
            &[
                "Fai uno screenshot (selezione → appunti)",
                "Cattura tutto lo schermo e salva sulla Scrivania",
            ],
        ),
        (
            "Note",
            &["Annota questo: ___", "Trova le note su ___, leggi le note recenti"],
        ),
        (
            "Memoria a lungo termine",
            &[
                "Si ricorda di te (nome, famiglia, preferenze, lavoro)",
                "\"Ricorda che ___\", \"Cosa sai di me?\", \"Dimentica quello\"",
            ],
        ),
        (
            "Stato Mac",
            &["Quanta batteria?, quanto manca alla carica completa?"],
        ),
        (
            "Blocco e stop",
            &[
                "Blocca lo schermo, spegni il display, vai in stop",
                "Non andare in stop, resta sveglio per 30 minuti, rilascia",
            ],
        ),
        (
            "Fine",
            &["Di' 'a dopo' o 'grazie' per tornare in standby"],
        ),
    ];
    render(categories)
}

fn capabilities_es() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("Conversación", &["Charlar, consejos, preguntas, lectura de la fortuna / horóscopo, chistes, escritura creativa (historias, letras, nombres), traducción, resúmenes (recuerda lo reciente)"]),
        (
            "Tiempo",
            &[
                "¿Qué hora es? / ¿Qué fecha es hoy?",
                "Pon un temporizador de 3 minutos (varios a la vez está bien)",
                "Despiértame mañana a las 7, recuérdame tomar la pastilla a las 8 (sobreviven al reinicio)",
            ],
        ),
        (
            "Calendario",
            &[
                "¿Qué tengo hoy?",
                "Agenda de mañana",
                "¿Qué sigue?",
            ],
        ),
        (
            "Clima",
            &["Tiempo aquí, ¿lloverá mañana?, tiempo en Madrid"],
        ),
        (
            "Calidad del aire / polvo",
            &[
                "¿Cómo está el aire hoy?, ¿y el PM2.5?, ¿hay polvo?, ¿el UV es alto?",
                "PM2.5, PM10, polvo e índice UV, aquí o en un lugar indicado (sin polen)",
            ],
        ),
        (
            "Qué pasó un día como hoy",
            &[
                "¿Qué pasó hoy?, ¿qué ocurrió el N de N?",
                "Eventos históricos del día, con el año (Wikipedia; recurre al inglés)",
            ],
        ),
        (
            "Noticias",
            &[
                "Últimas noticias (NHK principales)",
                "Noticias de tecnología (Hacker News), noticias del mundo (BBC)",
            ],
        ),
        (
            "Wikipedia",
            &["¿Qué es ___?, háblame de ___", "Capta hasta lo posterior al corte de conocimiento del modelo"],
        ),
        (
            "Terremotos",
            &["¿Sismos recientes?, ¿acabo de sentir un temblor?", "Lista más reciente de la JMA — epicentro, magnitud, intensidad"],
        ),
        (
            "Tipo de cambio",
            &["¿1 dólar en yenes?, ¿y el euro?", "¿Cuántos yenes son 100 dólares? (amount convierte al vuelo)"],
        ),
        (
            "Acciones e índices",
            &["¿Cotización de Apple?, ¿S&P hoy?, ¿Nikkei?", "Stooq (acciones US ~15min de retraso, sin clave, no para trading)"],
        ),
        (
            "Conversión de unidades",
            &["¿70°F en Celsius?, ¿5 millas en km?, ¿100 libras en kg?", "Temperatura / longitud / peso / volumen / velocidad / área"],
        ),
        (
            "Sol / luna",
            &["¿A qué hora se pone el sol hoy?, ¿y el amanecer?", "¿Esta noche hay luna llena? (edad lunar + etiqueta)"],
        ),
        (
            "Resumen de página",
            &["Lee la URL del portapapeles, resume ese enlace", "Extrae solo el cuerpo y resume en 2–4 frases"],
        ),
        (
            "Web",
            &[
                "Abre YouTube, abre la web de Apple",
                "Busca ___ en Google (en el navegador por defecto)",
            ],
        ),
        (
            "Apps y carpetas",
            &[
                "Abre Slack, abre Spotify, abre Notas",
                "Abre Descargas, abre Aplicaciones, abre la Papelera",
            ],
        ),
        ("Volumen", &["Pon el volumen a 30, baja un poco, silenciar"]),
        (
            "Música",
            &[
                "Siguiente canción, pausa (controla Spotify o Apple Music abierto)",
                "¿Qué está sonando? (lee el título y artista)",
            ],
        ),
        (
            "Fondo de pantalla",
            &[
                "Cambia el fondo de pantalla a un bosque, ponlo estético, cielo nocturno",
                "Cada monitor recibe una foto distinta (vía Pixabay)",
                "Pon la imagen del día de Wikipedia como fondo",
                "Pon una obra de arte como fondo (Art Institute of Chicago)",
            ],
        ),
        (
            "Reloj mundial",
            &[
                "¿Qué hora es en Londres?, ¿qué hora es en Nueva York?",
                "Hora actual de cualquier ciudad o país (la local es solo \"¿qué hora es?\")",
            ],
        ),
        (
            "Aurora / clima espacial",
            &[
                "¿Se puede ver la aurora esta noche?, ¿hay tormenta geomagnética?",
                "Visibilidad según el índice Kp de la NOAA y tu latitud (rara en latitudes medias)",
            ],
        ),
        (
            "Lugares cercanos",
            &[
                "¿Hay algo interesante cerca?, ¿qué hay por aquí?",
                "Artículos de Wikipedia cerca de ti, con distancia (radio ajustable)",
            ],
        ),
        (
            "Aviones sobre ti",
            &[
                "¿Qué avión pasa por encima?, ¿hay aviones arriba?",
                "Aviones sobre ti con indicativo, país de origen y altitud (OpenSky)",
            ],
        ),
        (
            "ISS (estación espacial)",
            &[
                "¿Dónde está la estación espacial ahora?, ¿dónde está la ISS?",
                "Posición actual de la ISS (océano/región aproximada), altitud y velocidad",
            ],
        ),
        (
            "Pokémon",
            &[
                "¿Cuáles son las estadísticas base de Pikachu?, ¿de qué tipo es Charizard?",
                "Estadísticas base, tipos y habilidades (PokéAPI)",
            ],
        ),
        (
            "Fórmula 1",
            &[
                "¿Cuándo es la próxima carrera de F1?, ¿resultados de la última?, ¿clasificación?",
                "Próxima carrera, último podio, clasificación actual (Jolpica)",
            ],
        ),
        (
            "Anime",
            &[
                "¿Cuántos episodios de ___?, ¿nota de ___?, ¿de qué va?",
                "Episodios, estado, nota, géneros y sinopsis (MyAnimeList)",
            ],
        ),
        (
            "Festivos",
            &[
                "¿Cuándo es el próximo festivo?, ¿hay festivos el mes que viene?",
                "Lista los festivos del año (cualquier país, 100+)",
            ],
        ),
        (
            "Olas / surf",
            &[
                "¿Cómo están las olas hoy?, ¿se puede surfear?",
                "Altura, periodo y dirección del oleaje en la costa (no en el interior)",
            ],
        ),
        (
            "Portapapeles",
            &["Léeme el portapapeles", "Escribe ___ y cópialo"],
        ),
        (
            "Capturas de pantalla",
            &[
                "Haz una captura (selección → portapapeles)",
                "Captura la pantalla y guárdala en el Escritorio",
            ],
        ),
        (
            "Notas",
            &["Apunta esto: ___", "Busca notas sobre ___, lee mis notas recientes"],
        ),
        (
            "Memoria a largo plazo",
            &[
                "Te recuerda (nombre, familia, preferencias, profesión)",
                "\"Recuerda que ___\", \"¿Qué sabes de mí?\", \"Olvida eso\"",
            ],
        ),
        (
            "Estado del Mac",
            &["¿Cuánta batería?, ¿cuánto falta para cargar?"],
        ),
        (
            "Bloqueo y suspensión",
            &[
                "Bloquea la pantalla, apaga la pantalla, suspender",
                "Que no se duerma, mantenlo despierto 30 min, libera eso",
            ],
        ),
        (
            "Salir",
            &["Di 'hasta luego' o 'gracias' para volver al modo de espera"],
        ),
    ];
    render(categories)
}

fn capabilities_fr() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("Conversation", &["Discuter, conseils, questions, voyance / tirage, blagues, écriture créative (histoires, paroles, noms), traduction, résumés (se souvient du récent)"]),
        (
            "Temps",
            &[
                "Quelle heure est-il ? / Quelle est la date ?",
                "Lance un minuteur de 3 minutes (plusieurs en même temps OK)",
                "Réveille-moi demain à 7 h, rappelle-moi de prendre mon médicament à 20 h (les rappels survivent au redémarrage)",
            ],
        ),
        (
            "Agenda",
            &[
                "Quel est mon planning aujourd'hui ?",
                "Mon agenda de demain",
                "Et après ?",
            ],
        ),
        (
            "Météo",
            &["Météo ici, faut-il un parapluie demain ?, météo à Paris"],
        ),
        (
            "Qualité de l'air / poussière",
            &[
                "Comment est l'air aujourd'hui ?, et le PM2.5 ?, y a-t-il de la poussière ?, l'UV est fort ?",
                "PM2.5, PM10, poussière et indice UV, ici ou dans un lieu indiqué (pas de pollen)",
            ],
        ),
        (
            "Que s'est-il passé ce jour",
            &[
                "Que s'est-il passé aujourd'hui ?, qu'est-il arrivé le N/N ?",
                "Événements historiques du jour, avec l'année (Wikipédia ; bascule en anglais)",
            ],
        ),
        (
            "Actualités",
            &[
                "Dernières actualités (NHK principales)",
                "Actu tech (Hacker News), actu monde (BBC)",
            ],
        ),
        (
            "Wikipédia",
            &["C'est quoi ___ ?, parle-moi de ___", "Attrape aussi ce qui suit la coupure de connaissance du modèle"],
        ),
        (
            "Séismes",
            &["Des séismes récents ?, je viens de sentir une secousse ?", "Liste JMA la plus récente — épicentre, magnitude, intensité"],
        ),
        (
            "Taux de change",
            &["1 dollar en yens ?, et l'euro ?", "Combien font 100 dollars en yens ? (amount convertit à la volée)"],
        ),
        (
            "Actions et indices",
            &["Cours d'Apple ?, S&P aujourd'hui ?, Nikkei ?", "Stooq (actions US ~15min de délai, sans clé, pas pour le trading)"],
        ),
        (
            "Conversion d'unités",
            &["70°F en Celsius ?, 5 miles en km ?, 100 livres en kg ?", "Température / longueur / poids / volume / vitesse / surface"],
        ),
        (
            "Soleil / lune",
            &["Coucher du soleil aujourd'hui ?, et le lever ?", "Pleine lune ce soir ? (âge lunaire + étiquette)"],
        ),
        (
            "Résumé de page",
            &["Lis l'URL du presse-papiers, résume ce lien", "Extrait seulement le corps et résume en 2–4 phrases"],
        ),
        (
            "Web",
            &[
                "Ouvre YouTube, ouvre le site d'Apple",
                "Cherche ___ sur Google (dans le navigateur par défaut)",
            ],
        ),
        (
            "Apps et dossiers",
            &[
                "Ouvre Slack, ouvre Spotify, ouvre Notes",
                "Ouvre Téléchargements, ouvre Applications, ouvre la Corbeille",
            ],
        ),
        ("Volume", &["Mets le volume à 30, baisse un peu, silence"]),
        (
            "Musique",
            &[
                "Piste suivante, pause (contrôle Spotify ou Apple Music ouvert)",
                "Qu'est-ce qui passe ? (lit le titre et l'artiste)",
            ],
        ),
        (
            "Fond d'écran",
            &[
                "Change le fond d'écran en forêt, mets-le esthétique, ciel nocturne",
                "Chaque écran reçoit une photo différente (via Pixabay)",
                "Mets la photo du jour de Wikipédia en fond d'écran",
                "Mets une œuvre d'art en fond d'écran (Art Institute of Chicago)",
            ],
        ),
        (
            "Horloge mondiale",
            &[
                "Quelle heure est-il à Londres ?, quelle heure à New York ?",
                "Heure actuelle de n'importe quelle ville ou pays (l'heure locale, c'est juste « quelle heure est-il ? »)",
            ],
        ),
        (
            "Aurore / météo spatiale",
            &[
                "Peut-on voir une aurore ce soir ?, une tempête géomagnétique ?",
                "Visibilité d'après l'indice Kp de la NOAA et ta latitude (rare aux latitudes moyennes)",
            ],
        ),
        (
            "Lieux à proximité",
            &[
                "Y a-t-il quelque chose d'intéressant à côté ?, qu'y a-t-il dans le coin ?",
                "Articles Wikipédia près de toi, avec la distance (rayon réglable)",
            ],
        ),
        (
            "Avions au-dessus",
            &[
                "Quel avion passe au-dessus ?, des avions là-haut ?",
                "Avions au-dessus de toi avec indicatif, pays d'origine et altitude (OpenSky)",
            ],
        ),
        (
            "ISS (station spatiale)",
            &[
                "Où est la station spatiale maintenant ?, où est l'ISS ?",
                "Position actuelle de l'ISS (océan/région approximative), altitude et vitesse",
            ],
        ),
        (
            "Pokémon",
            &[
                "Quelles sont les stats de base de Pikachu ?, le type de Dracaufeu ?",
                "Stats de base, types et capacités (PokéAPI)",
            ],
        ),
        (
            "Formule 1",
            &[
                "C'est quand la prochaine course de F1 ?, résultats de la dernière ?, classement ?",
                "Prochaine course, dernier podium, classement actuel (Jolpica)",
            ],
        ),
        (
            "Anime",
            &[
                "Combien d'épisodes de ___ ?, la note de ___ ?, ça parle de quoi ?",
                "Épisodes, statut, note, genres et synopsis (MyAnimeList)",
            ],
        ),
        (
            "Jours fériés",
            &[
                "C'est quand le prochain jour férié ?, des fériés le mois prochain ?",
                "Liste les fériés de l'année (tout pays, 100+)",
            ],
        ),
        (
            "Vagues / surf",
            &[
                "Comment sont les vagues aujourd'hui ?, c'est surfable ?",
                "Hauteur, période et direction des vagues sur la côte (pas à l'intérieur)",
            ],
        ),
        (
            "Presse-papiers",
            &["Lis le presse-papiers", "Écris ___ et copie-le"],
        ),
        (
            "Captures d'écran",
            &[
                "Fais une capture (sélection → presse-papiers)",
                "Capture tout l'écran et enregistre sur le Bureau",
            ],
        ),
        (
            "Notes",
            &["Note ceci : ___", "Cherche les notes sur ___, lis mes notes récentes"],
        ),
        (
            "Mémoire à long terme",
            &[
                "Se souvient de toi (nom, famille, préférences, métier)",
                "\"Souviens-toi que ___\", \"Que sais-tu de moi ?\", \"Oublie ça\"",
            ],
        ),
        (
            "État du Mac",
            &["Combien de batterie ?, combien avant la charge complète ?"],
        ),
        (
            "Verrouillage et veille",
            &[
                "Verrouille l'écran, éteins l'écran, mets en veille",
                "Empêche la veille, garde éveillé 30 minutes, annule",
            ],
        ),
        (
            "Fin",
            &["Dis « à plus tard » ou « merci » pour revenir en veille"],
        ),
    ];
    render(categories)
}

fn capabilities_de() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("Plaudern", &["Smalltalk, Rat, Fragen, Wahrsagen / Horoskop, Witze, kreatives Schreiben (Geschichten, Songtexte, Namen), Übersetzung, Zusammenfassungen (erinnert sich an Vorheriges)"]),
        (
            "Zeit",
            &[
                "Wie spät ist es? / Welches Datum ist heute?",
                "Stell einen 3-Minuten-Timer (mehrere parallel OK)",
                "Weck mich morgen um 7, erinnere mich um 20 Uhr an die Tabletten (überlebt Neustarts)",
            ],
        ),
        (
            "Kalender",
            &[
                "Was steht heute an?",
                "Mein Plan für morgen",
                "Was kommt als Nächstes?",
            ],
        ),
        (
            "Wetter",
            &["Wetter hier, brauche ich morgen einen Regenschirm?, Wetter in Berlin"],
        ),
        (
            "Luftqualität / Staub",
            &[
                "Wie ist die Luft heute?, und der PM2.5?, ist Staub in der Luft?, ist der UV hoch?",
                "PM2.5, PM10, Staub und UV-Index, hier oder an einem genannten Ort (kein Pollen)",
            ],
        ),
        (
            "Was war heute",
            &[
                "Was war heute?, was geschah am N.N.?",
                "Historische Ereignisse des Tages, mit Jahr (Wikipedia; weicht auf Englisch aus)",
            ],
        ),
        (
            "Nachrichten",
            &[
                "Aktuelle Nachrichten (NHK Top-Stories)",
                "Tech-News (Hacker News), Weltnachrichten (BBC)",
            ],
        ),
        (
            "Wikipedia",
            &["Was ist ___?, erzähl mir von ___", "Fängt auch ein, was nach dem Wissens-Cutoff des Modells kommt"],
        ),
        (
            "Erdbeben",
            &["Aktuelle Erdbeben?, hab ich gerade was gespürt?", "Aktuellste JMA-Liste — Epizentrum, Magnitude, Intensität"],
        ),
        (
            "Wechselkurs",
            &["1 Dollar in Yen?, und der Euro?", "Wieviel sind 100 Dollar in Yen? (amount rechnet direkt um)"],
        ),
        (
            "Aktien und Indizes",
            &["Apple-Kurs?, S&P heute?, Nikkei?", "Stooq (US-Aktien ~15min verzögert, ohne Key, nicht zum Handeln)"],
        ),
        (
            "Einheiten umrechnen",
            &["70°F in Celsius?, 5 Meilen in km?, 100 Pfund in kg?", "Temperatur / Länge / Gewicht / Volumen / Geschwindigkeit / Fläche"],
        ),
        (
            "Sonne / Mond",
            &["Wann geht die Sonne heute unter?, und auf?", "Ist heute Vollmond? (Mondalter + Label)"],
        ),
        (
            "Seitenzusammenfassung",
            &["Lies die URL aus der Zwischenablage, fasse diesen Link zusammen", "Holt nur den Body und fasst in 2–4 Sätzen zusammen"],
        ),
        (
            "Web",
            &[
                "Öffne YouTube, öffne Apples Webseite",
                "Google nach ___ (im Standardbrowser)",
            ],
        ),
        (
            "Apps & Ordner",
            &[
                "Öffne Slack, öffne Spotify, öffne Notizen",
                "Öffne Downloads, öffne Programme, öffne den Papierkorb",
            ],
        ),
        ("Lautstärke", &["Setz die Lautstärke auf 30, etwas leiser, stumm"]),
        (
            "Musik",
            &[
                "Nächster Song, Pause (steuert offenes Spotify oder Apple Music)",
                "Was läuft gerade? (liest Titel und Künstler vor)",
            ],
        ),
        (
            "Hintergrundbild",
            &[
                "Mach das Hintergrundbild zum Wald, ästhetisch, Nachthimmel",
                "Jeder Monitor bekommt ein eigenes Foto (über Pixabay)",
                "Mach das Wikipedia-Bild des Tages zum Hintergrund",
                "Mach ein Kunstwerk zum Hintergrund (Art Institute of Chicago)",
            ],
        ),
        (
            "Weltuhr",
            &[
                "Wie spät ist es in London?, wie spät in New York?",
                "Aktuelle Uhrzeit in jeder Stadt oder jedem Land (lokal ist einfach \"wie spät ist es?\")",
            ],
        ),
        (
            "Polarlicht / Weltraumwetter",
            &[
                "Kann ich heute Nacht Polarlichter sehen?, gibt's einen geomagnetischen Sturm?",
                "Sichtbarkeit aus NOAAs Kp-Index und deiner Breite (selten in mittleren Breiten)",
            ],
        ),
        (
            "Sehenswertes in der Nähe",
            &[
                "Gibt's was Interessantes in der Nähe?, was ist hier in der Gegend?",
                "Wikipedia-Artikel in deiner Nähe, mit Entfernung (Radius einstellbar)",
            ],
        ),
        (
            "Flugzeuge über dir",
            &[
                "Welches Flugzeug fliegt über mich?, sind Flugzeuge über mir?",
                "Flugzeuge über dir mit Rufzeichen, Herkunftsland und Höhe (OpenSky)",
            ],
        ),
        (
            "ISS (Raumstation)",
            &[
                "Wo ist die Raumstation gerade?, wo ist die ISS?",
                "Aktuelle ISS-Position (grobes Meer/Region), Höhe und Geschwindigkeit",
            ],
        ),
        (
            "Pokémon",
            &[
                "Wie sind Pikachus Basiswerte?, welcher Typ ist Glurak?",
                "Basiswerte, Typen und Fähigkeiten (PokéAPI)",
            ],
        ),
        (
            "Formel 1",
            &[
                "Wann ist das nächste F1-Rennen?, Ergebnis des letzten?, Fahrerwertung?",
                "Nächstes Rennen, letztes Podium, aktuelle Wertung (Jolpica)",
            ],
        ),
        (
            "Anime",
            &[
                "Wie viele Folgen von ___?, Bewertung von ___?, worum geht's?",
                "Folgen, Status, Bewertung, Genres und Handlung (MyAnimeList)",
            ],
        ),
        (
            "Feiertage",
            &[
                "Wann ist der nächste Feiertag?, gibt's nächsten Monat Feiertage?",
                "Nenne die Feiertage des Jahres (beliebiges Land, 100+)",
            ],
        ),
        (
            "Wellen / Surf",
            &[
                "Wie sind die Wellen heute?, kann man surfen?",
                "Wellenhöhe, -periode und -richtung an der Küste (nicht im Inland)",
            ],
        ),
        (
            "Zwischenablage",
            &["Lies die Zwischenablage", "Schreib ___ und kopier's"],
        ),
        (
            "Screenshots",
            &[
                "Mach einen Screenshot (Auswahl → Zwischenablage)",
                "Ganzes Display aufnehmen, auf den Schreibtisch speichern",
            ],
        ),
        (
            "Notizen",
            &[
                "Notiere das: ___",
                "Suche Notizen zu ___, lies meine neuesten Notizen",
            ],
        ),
        (
            "Langzeitgedächtnis",
            &[
                "Merkt sich Dinge über dich (Name, Familie, Vorlieben, Beruf)",
                "\"Merk dir ___\", \"Was weißt du über mich?\", \"Vergiss das\"",
            ],
        ),
        (
            "Mac-Status",
            &["Wie viel Akku?, wie lange noch bis voll?"],
        ),
        (
            "Sperren & Schlaf",
            &[
                "Bildschirm sperren, Display ausschalten, schlafen legen",
                "Nicht einschlafen, 30 Minuten wach halten, aufheben",
            ],
        ),
        (
            "Ende",
            &["Sag 'bis später' oder 'danke', um in den Standby zurückzukehren"],
        ),
    ];
    render(categories)
}

fn capabilities_zh() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("聊天", &["闲聊、咨询、回答问题、占卜·星座、笑话、创作（故事·歌词·起名）、翻译、摘要（记得最近的话题）"]),
        (
            "时间",
            &[
                "现在几点? / 今天日期?",
                "定一个 3 分钟计时器(可同时多个)",
                "明天 7 点叫我,晚上 8 点提醒我吃药(重启后保留)",
            ],
        ),
        (
            "日历",
            &[
                "我今天有什么安排？",
                "明天的日程",
                "下一个安排是什么？",
            ],
        ),
        ("天气", &["这里的天气, 明天要带伞吗?, 北京的天气"]),
        (
            "空气质量 · 沙尘",
            &[
                "今天空气怎么样?, PM2.5 多少?, 有沙尘吗?, 紫外线强吗?",
                "PM2.5、PM10、沙尘和紫外线指数,当前位置或指定地点(不支持花粉)",
            ],
        ),
        (
            "历史上的今天",
            &[
                "今天是什么日子?, N 月 N 日发生过什么?",
                "当天的历史事件,附年份(维基百科,没有则用英文)",
            ],
        ),
        (
            "新闻",
            &[
                "最新新闻 (NHK 主要新闻)",
                "科技新闻 (Hacker News), 国际新闻 (BBC)",
            ],
        ),
        (
            "维基百科",
            &["○○是什么？, 给我讲讲○○", "也能抓到模型知识截止之后的人和事"],
        ),
        (
            "地震信息",
            &["最近有地震吗？, 刚才晃了一下？", "气象厅最新地震列表 — 震源、震级、最大烈度"],
        ),
        (
            "汇率",
            &["1 美元多少日元？, 欧元呢？", "100 美元换多少日元？(amount 指定即时换算)"],
        ),
        (
            "股票·指数",
            &["苹果股价、今天的标普、日经？", "Stooq（美股延迟约 15 分钟，无需 key，仅供参考非交易用）"],
        ),
        (
            "单位换算",
            &["华氏 70 度是几度？, 5 英里是几公里？, 100 磅是几公斤？", "温度 / 长度 / 重量 / 体积 / 速度 / 面积"],
        ),
        (
            "日出 / 日落 / 月相",
            &["今天几点日落？, 日出呢？", "今晚是满月吗？(月龄 + 标签)"],
        ),
        (
            "网页摘要",
            &["读一下剪贴板里的链接, 总结这个链接", "只抽取正文，用 2–4 句概括"],
        ),
        (
            "网页",
            &[
                "打开 YouTube, 打开 Apple 官网",
                "Google 搜索 ___(在默认浏览器中)",
            ],
        ),
        (
            "应用和文件夹",
            &[
                "打开 Slack, 启动 Spotify, 打开备忘录",
                "打开下载, 打开应用程序, 打开废纸篓",
            ],
        ),
        ("音量", &["音量调到 30, 再小一点, 静音"]),
        (
            "音乐",
            &[
                "下一首, 暂停(控制已打开的 Spotify 或 Apple Music)",
                "现在播放什么?(读出歌名和艺术家)",
            ],
        ),
        (
            "壁纸",
            &[
                "把壁纸换成森林、夜空, 来个有质感的壁纸",
                "多显示器每块屏配不同照片(来自 Pixabay)",
                "把维基百科每日图片设为壁纸",
                "把名画设为壁纸(芝加哥艺术博物馆藏品)",
            ],
        ),
        (
            "世界时钟",
            &[
                "伦敦现在几点?, 纽约几点?",
                "任意城市或国家的当前时间(本地时间直接问'现在几点?')",
            ],
        ),
        (
            "极光 · 空间天气",
            &[
                "今晚能看到极光吗?, 有地磁暴吗?",
                "根据 NOAA 的 Kp 指数和你的纬度判断可见性(中纬度几乎看不到)",
            ],
        ),
        (
            "附近的地标",
            &[
                "附近有什么?, 这一带有什么看点?",
                "你附近的维基百科条目,带距离(半径可调)",
            ],
        ),
        (
            "头顶的飞机",
            &[
                "头顶上飞的是什么飞机?, 上空有飞机吗?",
                "你上空的飞机,带航班号、出发国和高度(OpenSky)",
            ],
        ),
        (
            "ISS(空间站)",
            &[
                "空间站现在在哪?, ISS 在哪?",
                "ISS 当前位置(大致海域/地区)、高度和速度",
            ],
        ),
        (
            "宝可梦",
            &[
                "皮卡丘的种族值是多少?, 喷火龙是什么属性?",
                "种族值、属性和特性(PokéAPI)",
            ],
        ),
        (
            "F1(一级方程式)",
            &[
                "下一场 F1 什么时候?, 上一场结果?, 车手排名?",
                "下一场比赛、上一场领奖台、当前排名(Jolpica)",
            ],
        ),
        (
            "动画",
            &[
                "___ 出到第几集了?, ___ 的评分?, 讲什么的?",
                "集数、放送状态、评分、类型和简介(MyAnimeList)",
            ],
        ),
        (
            "节假日",
            &[
                "下一个节假日是什么时候?, 下个月有假吗?",
                "列出今年的节假日(可指定国家, 100+ 国家)",
            ],
        ),
        (
            "海浪 · 冲浪",
            &[
                "今天浪怎么样?, 能冲浪吗?",
                "海岸的浪高、周期和方向(内陆不支持)",
            ],
        ),
        (
            "剪贴板",
            &["读一下剪贴板", "把 ___ 复制到剪贴板"],
        ),
        (
            "截图",
            &[
                "截图(框选 → 剪贴板)",
                "全屏截图并保存到桌面",
            ],
        ),
        (
            "备忘",
            &[
                "记一下: ___",
                "找一下关于 ___ 的备忘, 读最近的备忘",
            ],
        ),
        (
            "长期记忆",
            &[
                "记住你的事(名字、家人、喜好、职业)",
                "\"记住 ___\", \"你了解我什么?\", \"忘掉那个\"",
            ],
        ),
        ("Mac 状态", &["电量多少?, 还要多久充满?"]),
        (
            "锁定和睡眠",
            &[
                "锁屏, 关闭显示器, 睡眠",
                "别睡, 保持 30 分钟唤醒, 解除",
            ],
        ),
        ("结束", &["说『再见』或『谢谢』回到待机模式"]),
    ];
    render(categories)
}

fn capabilities_ja() -> String {
    let categories: &[(&str, &[&str])] = &[
        (
            "おしゃべり",
            &[
                "雑談、相談、質問への回答（直前の話題は覚えてる）",
                "占い、ジョーク、創作（物語・歌詞・名前決め）、翻訳、要約",
            ],
        ),
        (
            "時間",
            &[
                "今何時？／今日の日付",
                "3分タイマー、5分タイマー（複数同時 OK）",
                "明日7時に起こして、20時に薬って言って（再起動後も保持）",
                "毎朝7時に起こして、毎週月曜9時にミーティング（繰り返しリマインダー）",
            ],
        ),
        (
            "カレンダー",
            &[
                "今日の予定は？",
                "明日のスケジュール教えて",
                "次の予定は？",
            ],
        ),
        ("天気", &["現在地の天気、明日の傘いる？、東京の天気"]),
        (
            "空気の質・黄砂",
            &[
                "今日の空気どう？／PM2.5は？／黄砂きてる？／紫外線強い？",
                "PM2.5・PM10・黄砂・UV 指数を現在地や指定地で（花粉は非対応）",
            ],
        ),
        (
            "ニュース",
            &[
                "最新ニュース教えて（NHK 主要ニュース）",
                "テックニュース（Hacker News）、海外ニュース（BBC）",
                "プロ野球ニュース／大谷の最新／任天堂のニュース（任意トピック検索）",
            ],
        ),
        (
            "ウィキペディア",
            &[
                "○○ってなに？／○○について教えて",
                "知識カットオフ後の人物・出来事も拾える",
            ],
        ),
        (
            "今日は何の日",
            &[
                "今日は何の日？／N月N日は何があった日？",
                "その日の歴史上の出来事を年号付きで（Wikipedia、日本語が無ければ英語）",
            ],
        ),
        (
            "地震情報",
            &[
                "最近の地震は？／さっき揺れた？",
                "気象庁の最新地震一覧から、震源・マグニチュード・最大震度を読み上げ",
            ],
        ),
        (
            "為替",
            &[
                "ドル円教えて、ユーロは？",
                "100 ドルは何円？（amount 指定で換算）",
            ],
        ),
        (
            "株価・指数",
            &[
                "アップルの株価、S&P 今いくつ？、日経平均教えて",
                "Stooq（米株は約 15 分遅延、無料・無 key、取引には使わない）",
            ],
        ),
        (
            "単位換算",
            &[
                "華氏 70 度って何度？、5 マイルって何キロ？、100 ポンドは何キロ？",
                "温度・長さ・重さ・体積・速度・面積に対応（ローカル計算、為替は別）",
            ],
        ),
        (
            "日の出・日の入り・月",
            &[
                "今日の日の入り何時？、日の出は？",
                "今夜は満月？（月齢 + 8 段階の和名ラベル）",
            ],
        ),
        (
            "ページ要約",
            &[
                "クリップボードの URL 読んで、このリンク要約して",
                "本文だけ抜き出して 2-4 文で要約",
            ],
        ),
        (
            "ウェブ",
            &[
                "YouTube 開いて、Apple のサイト開いて",
                "○○ググって（既定ブラウザで Google 検索）",
            ],
        ),
        (
            "YouTube ミニプレイヤー",
            &[
                "YouTube で猫の動画流して（小窓で常に手前に表示）",
                "作業用 BGM 流して",
                "YouTube 閉じて",
            ],
        ),
        (
            "アプリ・フォルダ",
            &[
                "Slack 開いて、Spotify 起動して、メモ開いて",
                "ダウンロードフォルダ開いて、アプリケーションフォルダ開いて、ゴミ箱開いて",
            ],
        ),
        ("音量", &["音量30にして、もう少し下げて、ミュート"]),
        (
            "音楽",
            &[
                "次の曲、止めて（起動中の Spotify / Apple Music を操作）",
                "いま何の曲？（曲名・アーティスト読み上げ）",
            ],
        ),
        (
            "壁紙",
            &[
                "壁紙を森に変えて、夜空の壁紙にして、おしゃれな壁紙にして",
                "複数モニターには違う写真を 1 枚ずつ（Pixabay の写真を使用）",
                "今日の一枚を壁紙に（ウィキペディアの今日の写真）",
                "名画を壁紙に（シカゴ美術館の所蔵作品）",
            ],
        ),
        (
            "スマート家電（SwitchBot）",
            &[
                "リビングの電気つけて、エアコン消して、カーテン開けて",
                "操作できる家電を教えて（登録済みデバイス一覧）",
                "※設定画面で SwitchBot のトークンとシークレットの入力が必要",
            ],
        ),
        (
            "世界時計",
            &[
                "ロンドン今何時？／ニューヨークの時間は？",
                "都市・国を言うとその土地の現在時刻（現在地は『今何時？』）",
            ],
        ),
        (
            "オーロラ・宇宙天気",
            &[
                "今夜オーロラ見える？／磁気嵐きてる？",
                "NOAA の Kp 指数と緯度から可視性を判断（中緯度はまず不可）",
            ],
        ),
        (
            "近くの名所",
            &[
                "近くに何かある？／この辺の名所教えて",
                "現在地から近い Wikipedia 記事を距離つきで（半径指定可）",
            ],
        ),
        (
            "頭上の飛行機",
            &[
                "今頭の上飛んでる飛行機なに？／上空に飛行機いる？",
                "現在地上空の航空機を便名・出発国・高度つきで（OpenSky）",
            ],
        ),
        (
            "ISS（宇宙ステーション）",
            &[
                "宇宙ステーション今どこ？／ISS どこ飛んでる？",
                "ISS の現在地（おおまかな海域・地域）・高度・速度",
            ],
        ),
        (
            "ポケモン",
            &[
                "ピカチュウの種族値は？／リザードンのタイプは？",
                "種族値・タイプ・特性を返す（PokéAPI）",
            ],
        ),
        (
            "F1",
            &[
                "次のF1いつ？／前回の結果は？／ドライバーランキング",
                "次戦の日程・前回の表彰台・現在の順位（Jolpica）",
            ],
        ),
        (
            "アニメ",
            &[
                "○○って何話まで？／○○の評価は？／どんな話？",
                "話数・放送状況・スコア・ジャンル・あらすじ（MyAnimeList）",
            ],
        ),
        (
            "祝日",
            &[
                "次の祝日いつ？／来月祝日ある？",
                "今年の祝日教えて（国コード指定可、100+ カ国）",
            ],
        ),
        (
            "海・波",
            &[
                "今日の波どう？／波高い？／サーフィンできそう？",
                "海沿いの波高・周期・向き（内陸は対象外）",
            ],
        ),
        (
            "クリップボード",
            &["クリップボード読んで", "○○書いてコピーしといて"],
        ),
        (
            "スクリーンショット",
            &[
                "スクショ撮って（範囲選択 → クリップボード）",
                "全画面キャプチャして、デスクトップに保存して",
            ],
        ),
        (
            "メモ",
            &[
                "これメモして: ○○",
                "○○のメモ探して、最近のメモ読んで",
            ],
        ),
        (
            "長期記憶",
            &[
                "私のことを覚えてくれる（名前、家族、好み、職業など）",
                "「○○って覚えといて」「私について何知ってる？」「あの記憶忘れて」",
            ],
        ),
        (
            "Mac の状態",
            &["バッテリー何％？、充電あとどれくらい？"],
        ),
        (
            "ロック・スリープ",
            &[
                "画面ロック、ディスプレイ消して、スリープして",
                "スリープしないでおいて、30分起きてて、解除して",
            ],
        ),
        ("終了", &["「またね」「ありがとう」で待機モードに戻る"]),
    ];
    render(categories)
}

fn capabilities_en() -> String {
    let categories: &[(&str, &[&str])] = &[
        (
            "Conversation",
            &[
                "Casual chat, advice, Q&A (remembers the recent thread)",
                "Fortune-telling, jokes, creative writing (stories, lyrics, naming), translation, summarization",
            ],
        ),
        (
            "Time",
            &[
                "What time is it? / What's today's date?",
                "Set a 3-minute timer, set a 5-minute timer (multiple at once is fine)",
                "Wake me at 7 tomorrow, remind me to take meds at 8 PM (reminders survive restart)",
                "Wake me every morning at 7, every Monday 9 AM stand-up (recurring reminders)",
            ],
        ),
        (
            "Calendar",
            &[
                "What's on my calendar today?",
                "Tomorrow's schedule?",
                "What's next?",
            ],
        ),
        (
            "Weather",
            &["Weather here, do I need an umbrella tomorrow?, weather in Tokyo"],
        ),
        (
            "Air quality / dust",
            &[
                "How's the air today?, what's the PM2.5?, is there dust?, is UV high?",
                "PM2.5, PM10, dust and UV index, here or for a named place (no pollen)",
            ],
        ),
        (
            "On this day",
            &[
                "What happened on this day?, what happened on N/N?",
                "Historical events for the date, with the year (Wikipedia; falls back to English)",
            ],
        ),
        (
            "News",
            &[
                "What's the latest news? (NHK top stories)",
                "Tech news (Hacker News), world news (BBC)",
                "MLB news / Ohtani updates / Nintendo news (any topic search)",
            ],
        ),
        (
            "Wikipedia",
            &[
                "What's ___?, tell me about ___",
                "Catches people and events past the model's knowledge cutoff",
            ],
        ),
        (
            "Earthquakes",
            &[
                "Any recent quakes?, did I just feel one?",
                "JMA's latest list — epicenter, magnitude, max intensity",
            ],
        ),
        (
            "Exchange rates",
            &[
                "USD to JPY, what's the euro at?",
                "How much is 100 dollars in yen? (amount converts inline)",
            ],
        ),
        (
            "Stocks & indices",
            &[
                "Apple stock?, S&P today?, Nikkei?",
                "Stooq (US equities ~15min delayed, no key, not for trading)",
            ],
        ),
        (
            "Unit conversion",
            &[
                "70°F in Celsius?, 5 miles in km?, 100 pounds in kg?",
                "Temperature / length / weight / volume / speed / area (local math, currency is separate)",
            ],
        ),
        (
            "Sunrise / sunset / moon",
            &[
                "What time is sunset today?, when does the sun rise?",
                "Is it a full moon tonight? (moon age + label)",
            ],
        ),
        (
            "MLB scores",
            &[
                "Dodgers game today?, did the Yankees win?",
                "Live inning + score, final results from the official MLB schedule API",
            ],
        ),
        (
            "Page summary",
            &[
                "Read the URL on my clipboard, summarize this link",
                "Pulls just the body and condenses to 2–4 sentences",
            ],
        ),
        (
            "Web",
            &[
                "Open YouTube, open Apple's site",
                "Google ___ (searches in your default browser)",
            ],
        ),
        (
            "YouTube mini player",
            &[
                "Play cat videos on YouTube (always-on-top mini window)",
                "Put on some focus music",
                "Close YouTube",
            ],
        ),
        (
            "Apps & folders",
            &[
                "Open Slack, launch Spotify, open Notes",
                "Open Downloads, open Applications, open Trash",
            ],
        ),
        (
            "Volume",
            &["Set volume to 30, turn it down a bit, mute"],
        ),
        (
            "Music",
            &[
                "Next track, pause (controls a running Spotify or Apple Music)",
                "What's playing? (reads the track + artist)",
            ],
        ),
        (
            "Wallpaper",
            &[
                "Change my wallpaper to a forest, set an aesthetic wallpaper, make it night sky",
                "Each monitor gets its own photo (uses Pixabay)",
                "Set today's Wikipedia picture of the day as wallpaper",
                "Set a famous painting as wallpaper (Art Institute of Chicago)",
            ],
        ),
        (
            "Smart home (SwitchBot)",
            &[
                "Turn on the living room light, turn off the AC, open the curtains",
                "What devices can you control? (lists your registered devices)",
                "Note: needs your SwitchBot token & secret entered in Settings",
            ],
        ),
        (
            "World clock",
            &[
                "What time is it in London?, time in New York?",
                "Current time in any city or country (local time is just \"what time is it?\")",
            ],
        ),
        (
            "Aurora / space weather",
            &[
                "Can I see aurora tonight?, any geomagnetic storm?",
                "Visibility from NOAA's Kp index and your latitude (rarely at mid-latitudes)",
            ],
        ),
        (
            "Nearby landmarks",
            &[
                "Anything interesting nearby?, what's around here?",
                "Wikipedia articles near you, with distance (radius adjustable)",
            ],
        ),
        (
            "Planes overhead",
            &[
                "What plane is flying over me?, any planes overhead?",
                "Aircraft above you with callsign, origin country and altitude (OpenSky)",
            ],
        ),
        (
            "ISS (space station)",
            &[
                "Where's the space station now?, where's the ISS?",
                "The ISS's current position (rough ocean/region), altitude and speed",
            ],
        ),
        (
            "Pokémon",
            &[
                "What are Pikachu's base stats?, Charizard's type?",
                "Base stats, types and abilities (PokéAPI)",
            ],
        ),
        (
            "Formula 1",
            &[
                "When's the next F1 race?, last race results?, driver standings?",
                "Next race, last podium, current standings (Jolpica)",
            ],
        ),
        (
            "Anime",
            &[
                "How many episodes of ___?, ___'s rating?, what's it about?",
                "Episodes, status, score, genres and synopsis (MyAnimeList)",
            ],
        ),
        (
            "Public holidays",
            &[
                "When's the next holiday?, any holidays next month?",
                "List this year's holidays (any country, 100+ supported)",
            ],
        ),
        (
            "Waves / surf",
            &[
                "How are the waves today?, is it surfable?",
                "Wave height, period and direction for the coast (not inland)",
            ],
        ),
        (
            "Clipboard",
            &["Read the clipboard", "Write ___ and copy it for me"],
        ),
        (
            "Screenshots",
            &[
                "Take a screenshot (selection → clipboard)",
                "Capture the whole screen and save it to the desktop",
            ],
        ),
        (
            "Notes",
            &[
                "Make a note: ___",
                "Find notes about ___, read my recent notes",
            ],
        ),
        (
            "Long-term memory",
            &[
                "Remembers things about you (name, family, preferences, role)",
                "\"Remember that ___\", \"What do you know about me?\", \"Forget that\"",
            ],
        ),
        (
            "Mac status",
            &["What's the battery at? How long until it's charged?"],
        ),
        (
            "Lock & sleep",
            &[
                "Lock the screen, turn the display off, sleep",
                "Don't let it sleep, stay awake for 30 minutes, release that",
            ],
        ),
        (
            "End",
            &["Say 'see you' or 'thanks' to go back to standby"],
        ),
    ];
    render(categories)
}

fn render(categories: &[(&str, &[&str])]) -> String {
    let mut out = String::new();
    for (category, examples) in categories {
        out.push_str(&format!("【{category}】\n"));
        for ex in *examples {
            out.push_str(&format!("- {ex}\n"));
        }
    }
    out
}
