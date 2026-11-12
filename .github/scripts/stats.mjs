// Dibuja mis estadísticas de GitHub como SVG (claro y oscuro) con la paleta del perfil.
// Corre en la Action una vez al día. Uso: GITHUB_TOKEN=... node .github/scripts/stats.mjs <usuario> <carpeta>
import { writeFileSync, mkdirSync } from 'node:fs';

const [usuario = 'cristobalbelcor', salida = 'dist'] = process.argv.slice(2);
const anio = new Date().getUTCFullYear();

const r = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'perfil-stats' },
  body: JSON.stringify({
    query: `query($u:String!,$d:DateTime!){ user(login:$u){
      anio: contributionsCollection(from:$d){ totalCommitContributions restrictedContributionsCount totalPullRequestContributions }
      ultimo: contributionsCollection{ contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } } } } }`,
    variables: { u: usuario, d: `${anio}-01-01T00:00:00Z` },
  }),
});
const j = await r.json();
if (j.errors) throw new Error(JSON.stringify(j.errors));
const u = j.data.user;
const dias = u.ultimo.contributionCalendar.weeks.flatMap((w) => w.contributionDays);

// Rachas: la actual no se rompe por el día de hoy si aún no hay contribuciones.
let mejor = 0, corrida = 0;
for (const d of dias) { corrida = d.contributionCount ? corrida + 1 : 0; mejor = Math.max(mejor, corrida); }
let actual = 0;
for (let i = dias.length - 1; i >= 0; i--) {
  if (dias[i].contributionCount) actual++;
  else if (i === dias.length - 1) continue;
  else break;
}

const meses = new Map();
for (const d of dias) { const m = d.date.slice(0, 7); meses.set(m, (meses.get(m) || 0) + d.contributionCount); }
const serie = [...meses].slice(-12);
const NOMBRES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const datos = [
  [u.ultimo.contributionCalendar.totalContributions, 'contribuciones en el último año'],
  [u.anio.totalCommitContributions + u.anio.restrictedContributionsCount, `commits en ${anio} (con privados)`],
  [actual, actual === 1 ? 'día de racha actual' : 'días de racha actual'],
  [mejor, 'días de mejor racha'],
];

const TEMAS = {
  claro: { bg: '#ffffff', bd: '#d8dee4', tx: '#1f2328', mu: '#59636e', ac: '#1a7f37', barra: '#2da44e', vacia: '#ebedf0' },
  oscuro: { bg: '#0d1117', bd: '#26303d', tx: '#e6edf3', mu: '#8b949e', ac: '#3fb950', barra: '#2ea043', vacia: '#1c2330' },
};
const fmt = (n) => n.toLocaleString('es-CO');

mkdirSync(salida, { recursive: true });
for (const [nombre, t] of Object.entries(TEMAS)) {
  const W = 1280, H = 300, max = Math.max(1, ...serie.map(([, v]) => v));
  const fichas = datos.map(([n, txt], i) => {
    const x = 40 + (i % 2) * 340, y = 118 + Math.floor(i / 2) * 88;
    return `<text x="${x}" y="${y}" class="n" fill="${t.tx}">${fmt(n)}</text><text x="${x}" y="${y + 24}" class="t" fill="${t.mu}">${txt}</text>`;
  }).join('');
  const bx = 770, bw = 470, alto = 150, paso = bw / serie.length;
  const barras = serie.map(([m, v], i) => {
    const h = Math.max(3, (v / max) * alto), x = bx + i * paso + 6, y = 60 + alto - h;
    return `<rect x="${x}" y="${y}" width="${paso - 12}" height="${h}" rx="5" fill="${v ? t.barra : t.vacia}"><title>${m}: ${v}</title></rect>
      <text x="${x + (paso - 12) / 2}" y="${60 + alto + 22}" text-anchor="middle" class="m" fill="${t.mu}">${NOMBRES[+m.slice(5) - 1]}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estadísticas de GitHub de ${usuario}">
  <style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .n{font-size:40px;font-weight:800;letter-spacing:-1px}.t{font-size:14px}.m{font-size:12px}.h{font-size:13px;font-weight:700;letter-spacing:.5px;font-family:ui-monospace,"SF Mono",Menlo,monospace}</style>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="${t.bg}" stroke="${t.bd}"/>
  <text x="40" y="52" class="h" fill="${t.ac}">MI ACTIVIDAD</text>
  <text x="${bx + 6}" y="44" class="h" fill="${t.ac}">CONTRIBUCIONES POR MES</text>
  ${fichas}${barras}
  <text x="40" y="${H - 34}" class="m" fill="${t.mu}">Incluye el trabajo en repositorios privados (clientes y producción). Se actualiza solo cada día.</text>
</svg>`;
  writeFileSync(`${salida}/stats-${nombre}.svg`, svg);
}
console.log('stats:', datos.map(([n]) => n).join(' · '));
