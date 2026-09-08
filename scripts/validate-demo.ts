import { demoCatalog } from "../shared/demo-catalog";
import { extractYouTubeId } from "../shared/youtube";
const ids = new Set<string>();
for (const video of demoCatalog) {
  if (
    !extractYouTubeId(video.youtubeUrl) ||
    !video.title.trim() ||
    !video.category.trim() ||
    ids.has(video.id)
  )
    throw new Error(`Projeto demonstrativo inválido: ${video.id}`);
  ids.add(video.id);
}
if (
  !demoCatalog.length ||
  demoCatalog.filter((video) => video.isShowreel).length !== 1
)
  throw new Error("O catálogo deve conter projetos e exatamente um showreel.");
console.log(
  `Catálogo válido: ${ids.size} projetos. Disponibilidade externa do YouTube não é garantida por esta validação.`,
);
