# Pacote de natureza: integração dos modelos

## Implementado

O jogo incorpora os 150 modelos do Ultimate Nature Pack by Quaternius: 94 árvores,
21 pedras e 35 elementos de vegetação e decoração. As formas de cada família,
palmeiras e variantes de outono/neve/morte são selecionadas pelos [biomas de vegetação](biomas-vegetacao.md).
CommonTree representa visualmente o carvalho do catálogo; o nome do recurso
original não identifica essa espécie botânica.

`src/render/nature-models.js` adapta os modelos ao banco de geometrias de
`src/render/vegetation.js`. O banco compartilha geometrias por variante, com sete
formas para cada acabamento de pedra; a variante de pedra é compartilhada por
célula de 64 m para limitar os lotes. Os lotes continuam usando InstancedMesh e os materiais de vento e cor
por vértice existentes. Os modelos são criados uma vez por banco e descartados
junto com ele. Não há novos carregadores ou dependências no runtime.

Os materiais Kd dos MTL são tratados como cores lineares e quantizados em 8 bits.
Posições usam int16 com escala por modelo e normais usam int16 normalizado.
Os buffers ficam codificados em base64 em `src/render/assets/nature.json` e são
decodificados quando necessários. Os 150 modelos somam 183.494 triângulos perto
e 101.184 na versão simplificada distante.
O arquivo integra o bundle inicial; streaming fica para uma etapa posterior.

O conversor também preserva uma classificação de superfície por vértice:
folhagem, madeira, pedra e casca de bétula. `objectMaterial` em
`src/render/materials.js` usa essa classificação para aplicar manchas de folhas,
veios verticais, grão mineral e marcas de casca, com contraste moderado e redução
do detalhe fino pela distância em tela. As coordenadas locais mantêm o padrão
preso ao modelo durante o vento. Atributos ausentes mantêm o acabamento procedural.
Os lotes de vegetação recebem sombras das construções; não passam a emitir
sombras dinâmicas adicionais. O filtro pixelado e os materiais das casas são
preservados. Não foram adicionados polígonos ou materiais por objeto.

A base de cada geometria fica em y=0. As árvores usam as dimensões de SPECIES em
`src/world/catalog.js`; pedras e decorações têm envelopes próprios por tipo. A
transformação individual e os pontos de coleta de árvores/pedras permanecem os
mesmos. A acácia mantém seu modelo procedural. Primavera usa os modelos verdes;
outono usa as variantes Autumn.

O piloto preserva geração, sementes, identidades, ocupação, coleta, inventário e
formato do save. A geometria de apresentação não participa dessas regras.

## Limites e próxima etapa

Os modelos importados usam os mesmos atributos e a mesma variante nas duas
distâncias, com índices simplificados para a vista distante. O conversor usa
MeshoptSimplifier, incluído no Three.js, com alvo de 55% dos triângulos e erro
ponderado de até 0,02. O erro considera posição, normais, cores e classe de
superfície; não substitui uma comparação visual de todas as silhuetas. As árvores
ficaram com aproximadamente 45% menos triângulos. As rochas reduzem menos por
respeitarem o limite de erro. Não se usam os modelos procedurais antigos como LOD
das espécies importadas. A preparação é offline e não adiciona WASM ao runtime.
A acácia continua procedural. Pedras nevadas aparecem em tundra/neve; pedras
musgosas em mata ciliar/pântano. Arbustos, frutos, cactos, flores, gramíneas e
plantas de margem substituem os modelos procedurais simples. Campos usam trigo
e milho. Tocos e troncos aparecem raramente como decoração sem coleta. O modelo
de vitória-régia está preparado, mas sua colocação aguarda a reconstrução da
superfície visual da água. O pacote não implementa regras de estações,
agricultura, derrubada ou coleta dos novos enfeites.

Antes de expandir, validar no navegador a cor, o vento, a transição de distância,
a seleção, as copas próximas de construções e a legibilidade com o filtro pixelado.
Medir chamadas de desenho, triângulos, memória, montagem de chunks e p95 de quadro
nas mesmas sementes e câmeras, incluindo florestas densas e mapa máximo, conforme
[Validação](validacao.md). Instanciamento não elimina o custo dos triângulos.

## Reproduzir os dados

Com as dependências do projeto instaladas, execute na raiz:

```powershell
node tools/prepare-nature.mjs 'C:\caminho\Ultimate Nature Pack by Quaternius'
npm test
npm run build
npm run playtest
```

O conversor lê OBJ e MTL, verifica materiais e limites de índices, reúne as
geometrias e gera o JSON consumido pelo renderer. Quando o OBJ não contém uma
malha triangular (Plant_5), o conversor lê a malha equivalente do FBX. O pacote
original permanece fora do repositório; Blender não é necessário.

Licença e autoria: [avisos de terceiros](../THIRD_PARTY_NOTICES.md) e
[declaração CC0 fornecida no pacote](../public/third-party/Quaternius-Nature-CC0.txt).

## Verificação da integração inicial

Testes de domínio e geometria e build executados. O teste de geometria cobre
as quatro espécies, duas variantes por estação, limites, índices e cores;
também cobre compartilhamento do banco e fallback procedural.

Playtest tentado em 5917 e com servidor dedicado em 5923. O acesso HTTP local
retornou EACCES no Node; o navegador retornou ERR_CONNECTION_TIMED_OUT.
Não houve inspeção visual nem medição válida de desempenho nesta sessão.
O piloto foi implementado antes da expansão dos recursos decorativos.

Na correção da troca de distância, o navegador já aberto em 5917 ficou acessível.
A vila da semente 1769 foi conferida perto e após três cliques em Afastar, com
capturas de inspeção: os modelos do pacote permaneceram na vista distante.
Os 32 testes e o build passaram novamente. A medição comparativa de desempenho
em florestas densas e mapa máximo continua pendente.

O acabamento das superfícies foi conferido no navegador na vila da semente 1769,
na vista inicial e após dois cliques em Aproximar. O console não registrou erros.
Os 32 testes e o build passaram. Falta medir o custo adicional do shader em
hardware móvel e florestas densas.


A apresentação agrupa instâncias em células de 64 m via
`src/render/vegetation-batches.js`, mantendo recursos e consultas em chunks de
32 m. Mudanças de visibilidade, coleta e descarte invalidam apenas as células
afetadas; a recomposição é limitada a duas células por quadro. Geometrias
continuam compartilhadas e pertencem ao banco.

A [comparação de desempenho](otimizacao-render.md) registra condições e limites.


A distribuição regional e a ampliação do pacote para 150 modelos substituem o
escopo inicial de 19 e o piloto de 97 modelos descritos nas verificações históricas.
Veja [biomas de vegetação](biomas-vegetacao.md) para contratos e limites atuais.

## Recursos complementares

O conversor gerou as 150 entradas do catálogo; cada uma tem índices próximos e
distantes. A distribuição acrescenta os 21 modelos de pedra e usa os enfeites
nos tipos de terreno existentes. A malha de vitória-régia permanece no catálogo
até haver uma superfície de água para colocá-la. O custo de quadro e a leitura
visual dos novos lotes ainda precisam de conferência no navegador. `npm run build`
passou: bundle principal de 11,03 MB (3,10 MB gzip), com o aviso existente de
chunk acima de 500 kB. A bateria de testes e o playtest visual não foram rodados
nesta expansão; medição de desempenho também permanece pendente.

## Vegetação complementar do MegaKit

O jogo prepara também 19 modelos do MegaKit Standard, dos quais 12 modelos verdes entram na distribuição atual. Gramas comuns/finas, curtas/altas, trevos, samambaia, quatro plantas e arbusto verde usam um atlas compartilhado com transparência. Flores coloridas, cogumelos, frutos vermelhos e cactos floridos foram retirados da distribuição por preferência do usuário; os ativos preparados não foram apagados. A base da folhagem é verde e recebe tom amarelado progressivo nas regiões mais quentes. A geometria artificial de dez cópias sobrepostas foi removida. [Regras e verificação atuais](biomas-vegetacao.md).

A conversão do MegaKit é reproduzida por `node tools/prepare-megakit-plants.mjs <pasta-do-MegaKit>`; requer Python com Pillow para gerar o atlas. Verificados 57 testes, build e vista próxima no navegador em 5173, sem erros no console. O atlas acrescenta aproximadamente 0,90 MB e o catálogo aproximadamente 0,45 MB antes de compressão. O bundle principal ficou em 11,48 MB (3,33 MB gzip), com aviso de chunk grande. O custo de FPS nas florestas densas continua sem medição comparativa.
