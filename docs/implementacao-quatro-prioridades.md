# Revisão integrada: água, vegetação, fauna e observabilidade

**Branch de implementação:** `feat/hydrology-fauna-vegetation-metrics-20261118`.
**Base:** PR #1 (`fix/fauna-bioma-animacao-variantes-20261115`), e não a cópia
local do ZIP `Word-fauna-precarregada.zip`. O ZIP já possui alterações de
carregamento antecipado que ainda não estão publicadas na branch GitHub.
**Antes de integrar:** reconciliar com esse ZIP. Não substituir o ZIP pela
branch como se fossem equivalentes.

## 1. Água e hidrologia

- `river-pockets.js` preenche somente bolsões secos minúsculos (até três
  células), totalmente cercados por água de rio, com alturas coerentes.
  Costas abertas, terreno bloqueado, penhascos e ilhas de quatro ou mais
  células permanecem intactos. O passe roda só durante a geração.
- A água usa deslocamento visual fixo de 4 mm em vez de 12 mm; o plano de
  reflexo do lago acompanha essa mesma altura.
- O shader reduz inclinações exageradas, perturbações nos estuários e
  pulso de transparência do lago. A absorção de cor distingue rio/lago/mar.
- **Não concluído:** revisar manualmente todos os meandros, refluxos,
  desembocaduras, foz rasa, margens e profundidade em múltiplas seeds.
  Nem toda ilha incomum é uma falha: ilhas topográficas reais são preservadas.

## 2. Vegetação sem popping

- A câmera não promove/despromove malha visível por distância de chunk.
  Todos os chunks mostrados usam geometrias completas.
- Foi removido o shader que diminuía grama até desaparecer, inclusive no zoom.
- `VegetationBatches` agora usa índice por célula para não percorrer todos
  os chunks a cada lote sujo.
- **Compromisso:** essas alterações privilegiam estabilidade visual. A
  geometria completa pode elevar o uso de GPU. LOD agressivo com impostors
  requer crossfade temporal/dither validado visualmente no browser; esta
  revisão NÃO afirma que o LOD distante está pronto ou que ele ganhou FPS.
- O pré-carregamento e a transição de câmera da última versão local devem ser
  mantidos na integração.

## 3. Ecologia real inicial

- Vaca, galinha e raposa têm fome/sede/fadiga/medo/saúde e características
  individuais determinísticas.
- Planejamento limitado por tick, com histerese, memória de até seis pontos
  de recurso e busca local de água doce/forragem.
- Pasto possui estoque compartilhado por célula 4×4 m, regeneração por tempo
  simulado e débito limitado; água salgada não é bebida.
- Galinha foge da raposa em raio local; raposa persegue galinha quando tem
  fome e provoca dano real com intervalo entre ataques.
- A simulação usa `FaunaSystem` (10 Hz) e `FaunaMotion`, nunca a animação
  para confirmar efeitos. As outras espécies mantêm o comportamento anterior.
- **Não concluído:** pathfinding regional/A*, testes reais de obstáculos
  complexos, cadáver/remoção, crescimento populacional, reprodução,
  estoque ecológico persistido, grupos, vida fora de regiões ativas, saves
  de fauna e comportamento completo das demais 19 espécies.
- A migração de saves antigos não foi priorizada, pois o jogo está em
  desenvolvimento.

## 4. Medição

- `WorldView.diagnostics()`: média de FPS, p95 e pior quadro (ms), quadros
  acima de 50 ms, CPU de renderização, p95 de GPU quando a extensão WebGL
  permite, memória JS quando disponível, duração da geração e primeiro quadro.
- `npm run benchmark:world`: gera seeds 1769 e 454 em 256/1024 m e mede
  CPU/RSS/bytes de grades; sem simular GPU.
- `npm run benchmark:world -- --large`: testa 1024/5000 m. **Exige
  muita memória**; executar em sistema com RAM suficiente e monitorar RSS.
- `npm test`, `npm run build` e playtest WebGL real são gates. Não foram
  executados neste ambiente e não existem números de ganho de FPS validados.

### Checklist de aceite manual (Windows/Chrome)

1. Começar seed 1769 com mapa de 1024 m. Verificar 30 segundos sem plantas
   aparecendo/desaparecendo com pan, zoom e primeira pessoa.
2. Visitar um leito estreito, a foz no mar e a saída de um lago. Conferir se
   não existem bolsas secas isoladas, recortes artificiais ou água flutuando.
3. Deixar vacas e galinhas próximas de água doce; verificar busca, alimentação,
   descanso e indicadores da simulação. Confirmar que a vaca não bebe no mar.
4. Observar galinha/raposa com prioridade de fuga/perseguição e dano.
5. Medir FPS médio, p95 de quadro, GPU, heap e tempo de carregamento, com
   a mesma seed, câmera e dispositivo antes/depois.
6. Repetir 1024 m com vegetação máxima e fauna densa. Só depois testar 5000 m
   e registrar tempo máximo de geração e pico de memória.

## Próximo gate de integração

A branch GitHub não inclui o pacote local de `procedural-animals` do ZIP
corrigido para Windows nem a versão local completa do carregamento antecipado.
Não é um ZIP substituto. Integrar mudanças **sobre a versão
`Word-fauna-precarregada`**, resolver diferenças e só publicar nova versão
jogável após `npm ci`, `npm test`, `npm run build` e playtest WebGL.
