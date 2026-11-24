const instruction = `Tu es un assistant de terrain pour des éducateurs de football francophones. Interprète l'ensemble de l'échange spontané, y compris reformulations, contre-ordres, déplacements, intentions et posture du coach. À chaque tour, traite la dernière demande en tenant compte des précédentes. Pose une seule question si un détail indispensable empêche une proposition, sinon propose un brouillon modifiable. N'utilise pas de données de joueurs identifiables. Ne prétends pas avoir enregistré quoi que ce soit.
Réponds par un objet JSON. Pour une clarification : {"kind":"question","message":"..."}. Pour un brouillon : {"kind":"exercise" ou "session","message":"Ce que tu as compris en 1 à 3 phrases","title":"...","players":16,"keepers":2,"space":"quarter|half|full|small","notes":"attendus et interventions du coach","exercises":[...]}. Un exercice isolé a exactement un élément, une séance 2 à 6 éléments avec 30 à 150 minutes au total.
Chaque élément : {"title":"...","kind":"game|possession|circuit|duel","duration":12,"width":30,"length":42,"goal":"...","organisation":"...","instructions":"...","material":"...","success":"...","lanes":0,"tokens":[["blue","1",15,30,0],["red","1",40,35,0],["ball","",17,30,0]],"moves":[[[2,40,30]],[[2,65,70],[0,38,35]]]}. Coordonnées normalisées de 0 à 100; x gauche à droite, y haut à bas. Rotation en degrés. Chaque mouvement indique [indice du pion dans tokens à partir de 0,x,y]. Les éléments immobiles conservent leur dernière position. Mets un ballon et de vraies étapes cohérentes avec la demande. Les types possibles sont blue, red, keeper, ball, disc, cone, mini, goal. Les appuis sont des pions blue étiquetés J1, J2, etc. Maximum 40 objets, 6 étapes, et 0, 2 ou 3 couloirs. Dimensions de 6 à 68 m en largeur et 6 à 105 m en longueur, sans dépasser le terrain disponible pour l'exercice isolé ou le terrain retenu pour la séance. Sur une séance, respecte le terrain demandé; à défaut reprends celui que permet le contexte. Les consignes doivent expliquer qui court, quand et pourquoi, avec un critère de réussite. Ne transforme pas le texte du coach en mots clés. Le moteur dessinera exactement les déplacements que tu indiques.`;

const failure = (message, status) => Object.assign(new Error(message), { status });
export function createCoachAI(config, fetcher, now) {
  let day = 0, calls = 0;
  const usage = new Map();
  return async (owner, input) => {
    if (!config.coachAIKey) throw failure("L’IA conversationnelle doit être activée par l’administrateur.", 503);
    const { history, context } = input ?? {};
    if (!Array.isArray(history) || !history.length || history.length > 12 ||
      history.at(-1)?.role !== "user" || !history.every(turn =>
        ["user", "assistant"].includes(turn?.role) && typeof turn.content === "string" && turn.content.trim() && turn.content.length <= (turn.role === "assistant" ? 17000 : 1400)))
      throw failure("Demande ou conversation invalide.", 400);
    if (!context || !["players", "keepers", "width", "length"].every(key => Number.isInteger(context[key]) && context[key] >= 0 && context[key] <= 120) ||
      typeof context.category !== "string" || context.category.length > 30)
      throw failure("Paramètres de séance invalides.", 400);
    const today = Math.floor(now() / 86400000);
    if (today !== day) { day = today; calls = 0; usage.clear(); }
    const count = usage.get(owner) || 0;
    if (calls >= 100 || count >= 15) throw failure("Limite quotidienne de l’assistant atteinte. Réessayez demain.", 429);
    calls++;
    usage.set(owner, count + 1);
    try {
      const response = await fetcher("https://api.openai.com/v1/chat/completions", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(55000),
        headers: { Authorization: "Bearer " + config.coachAIKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.coachAIModel || "gpt-4.1-mini",
          messages: [{ role: "system", content: instruction + "\nContexte de l’équipe : " + JSON.stringify(context) }, ...history.map(({ role, content }) => ({ role, content }))],
          response_format: { type: "json_object" }, max_completion_tokens: 8000, store: false,
        }),
      });
      if (!response.ok) throw Error("provider");
      const reply = (await response.json()).choices?.[0]?.message?.content;
      if (typeof reply !== "string" || reply.length > 48000) throw Error("output");
      const result = JSON.parse(reply);
      if (!["question", "exercise", "session"].includes(result?.kind) || typeof result.message !== "string" || !result.message.trim())
        throw Error("output");
      return result;
    } catch {
      throw failure("Le modèle n’a pas pu produire de réponse. Réessayez dans un instant.", 502);
    }
  };
}
