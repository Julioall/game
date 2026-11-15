# Protótipo e migração

## Estado atual

**Água visual reconstruída com NVJOB.** Rios, lagos e mar usam uma adaptação para Three.js do Water Surface v1.6, com cinco texturas originais, normais em camadas, parallax e brilho Fresnel. As superfícies acompanham o recorte da hidrologia. Consultas, travessia, sementes e saves permanecem iguais. As descrições antigas de espuma costeira e ondas abaixo são históricas; o acabamento atual está na seção NVJOB.


O repositório contém o protótipo executável. O mapa permite até 5.000 × 5.000 m. Há vilas, solares, castelos e grandes cidades. A câmera livre permite navegar, inspecionar o terreno, coletar madeira e pedra e construir uma cabana. A coleta e a construção persistem por configuração no navegador.

O tamanho padrão e o menor tamanho oferecido pelo gerador são 1.024 × 1.024 m. URLs ainda podem carregar mapas menores já existentes.

O modo experimental de travessia permite caminhar, vadear e nadar em superfícies naturais. Sua posição vale para a sessão. A integração com pontes, portas, interiores e tarefas continua nos próximos recortes. A [revisão da água e arquitetura](revisao-agua-arquitetura.md) registra contratos, limites e medições.

| Área | Implementação |
| --- | --- |
| Terreno e água | `src/world/terrain/` separa relevo, hidrologia, drenagem e validação de solo. `src/world/generate.js` orquestra a geração. `src/render/terrain.js` gera o terreno; `water-geometry.js` recorta a água e `water.js` aplica o material NVJOB. |
| Vegetação e árvores | `src/world/ecology.js` classifica biomas. `src/world/vegetation.js` gera recursos e plantas por chunk, com IDs derivados da semente e das coordenadas globais. `src/render/vegetation.js` monta os modelos e as instâncias. A coleta resolve o alvo no mundo pelo ID. |
| Fauna ambiente | `src/world/fauna-catalog.js` define as espécies; `src/world/fauna.js` distribui 1.024 indivíduos; `src/world/fauna-system.js`, pertencente ao `WorldState`, atualiza posições e índice móvel em passo fixo. `src/render/fauna.js` cuida apenas dos modelos e animações. [Auditoria e próximos recortes](auditoria-fauna.md). |
| Construções | `src/world/construction.js` valida lotes com índices locais e `src/world/buildings.js` fornece dimensões, fundação e referência de entrada das casas. `src/render/structures.js` compõe a malha de construções com os módulos de casas, pontes e fortificações. |
| Estado e apresentação | `src/world/state.js` aplica coleta e construção, mantém os deltas e fornece consultas de leitura para a visualização. `src/render/view.js` cuida da câmera, chunks visíveis e seleção. `src/main.js` conecta interface, plataforma e regras. |
| Plataforma | `src/platform/world-worker.js` gera e transfere o mundo, depois encerra. `src/platform/local-save.js` usa a mesma chave e o mesmo formato de save do protótipo de origem. |
| Testes e pesquisa | `test/world.test.js` e `test/fauna.test.js` cobrem geração, ocupação, persistência e candidatos de fauna. `tools/playtest.mjs` percorre o jogo no navegador. [Pesquisa e atribuições](pesquisa.md) e [avisos de terceiros](../THIRD_PARTY_NOTICES.md) registram referências e licenças. |

A fauna mantém estado autoritativo de sessão separado de Three.js. Sua população, posições e deslocamento são independentes da criação ou descarte dos modelos. A região relevante para a fauna ambiente usa a posição do jogador ou o foco de exploração; animais distantes permanecem adormecidos. O save conserva a versão 1 e ainda não persiste fauna. A apresentação usa 48 malhas low pré-geradas, duas aparências por espécie, baixadas por necessidade. A preparação começa antes da borda visível e a fila mantém no máximo dois trabalhos de criação pendentes, com retenção ampliada e entrada curta. A abertura aguarda os modelos enquadrados por até três segundos. Atlas continua pendente; a auditoria de fauna detalha limites e validação.

A importação preservou o protótipo em um commit próprio. Os commits seguintes organizaram, em ordem, terreno e água, vegetação e árvores, e construções. O índice das construções considera a área de influência em mais de um chunk e aplica a mesma geometria de ocupação do protótipo. A planta inicial das casas fornece medidas e posição de entrada. Portas jogáveis e navegação interior são o próximo recorte.

O índice de povoados expõe apenas consultas e devolve registros imutáveis separados dos dados de origem. A apresentação consulta as células da grade por índice, sem acesso aos buffers usados pela simulação. A projeção copia apenas os metadados necessários à interface. Ao carregar um save da versão atual, o estado preserva registros válidos, ignora construções inválidas e zera saldos que não sejam inteiros seguros e não negativos. Saves ilegíveis ou de versão desconhecida iniciam um estado vazio.

## Próximas etapas

1. **Cabana habitável.** Adicionar personagem, superfícies navegáveis, porta e visibilidade do telhado a partir da planta da cabana. Validar entrada, saída, alcance e persistência.
2. **Tarefa autônoma.** Introduzir coleta com deslocamento, reserva e cancelamento. Usar as mesmas regras de coleta para o jogador e os habitantes.
3. **Escala de simulação.** Medir tempo por sistema, custo de navegação e quantidade de entidades ativas antes de escolher ECS completo ou um Worker de simulação. Usar os [critérios de validação](validacao.md).

Uma mudança de ID, versão de geração ou esquema de save exige plano de compatibilidade e teste de saves anteriores.

### Água e interações aquáticas

1. **Base implementada.** A hidrologia grava o tipo da água e a direção de jusante em um byte por célula. `WorldState.waterAt(x, z)` consulta a superfície recortada, profundidade e corrente relativa dentro do mapa. O shader anima os rios a jusante, usa ondulações mais lentas nos lagos e mais largas no mar. A inspeção mostra o tipo e a profundidade ao clicar na água.
2. **Travessia em teste jogável.** Use **Explorar a pé**, clique em terra firme perto de uma margem e mova o personagem com WASD, setas ou toque no destino. O estado valida cada passo a 30 Hz. O personagem vadeia a partir de 0,15 m e nada a partir de 1 m, com deriva em água corrente. O movimento confirmado pode emitir ondulações. Esc, o botão do modo e os atalhos de mapa encerram a travessia. A posição vale para a sessão e fica fora do save. A navegação considera o relevo e a água. Colisões com estruturas, pontes e busca de caminhos ficam para o recorte de navegação do personagem.
3. **Próximo recorte da água.** Definir o habitat das primeiras espécies por tipo de água, profundidade e corrente. Validar os deslocamentos em trechos conectados, inclusive nas margens e confluências, e medir o custo da atividade local.

A direção escolhida é manter a superfície visual no shader e consultar a hidrologia para decisões de jogo. Avaliar ondas de Gerstner se o mar precisar de relevo visível e PBF se uma interação local exigir movimento de volume. As duas técnicas ficam como opções de protótipo.

O acabamento em `src/render/water.js` e `src/render/materials.js` mistura a corrente visual em até três células vizinhas e combina ondas de lago e mar nas desembocaduras. O leito tinge a água rasa conforme a profundidade. A espuma segue a corrente nos rios e acompanha as ondas nas praias. A superfície externa do oceano cobre apenas a área fora do mapa para evitar sobreposição nos canais baixos.

`src/render/coast.js` combina três grupos de frentes costeiras com frequências, fases e extensão diferentes. O ruído em coordenadas globais fragmenta as frentes e desloca o momento da quebra ao longo da costa. A profundidade e a inclinação do leito orientam a aproximação. A água e a película sobre a areia compartilham a mesma função de avanço e recuo. A película usa apenas triângulos próximos do mar, fica limitada a 0,22 m acima do nível da água e permite clicar no terreno abaixo dela. A animação é procedural no shader e acompanha a preferência de movimento reduzido.

As desembocaduras fornecem trajetos visuais de corrente por 14 a 32 m dentro da água receptora, conforme a vazão. `src/world/terrain/water-flow.js` traça esses trajetos pela água disponível, contorna margens e reduz a intensidade até integrar o movimento ao lago ou mar. A consulta da apresentação usa os candidatos locais do índice por chunk, incluindo a área de espalhamento. O shader aplica o mesmo movimento à espuma e aos reflexos na transição.

A apresentação também transmite a intensidade, o avanço e a posição lateral na zona de mistura. O shader usa esses dados para formar ondulações de encontro entre a corrente e as ondas receptoras, dois giros laterais sutis e espuma de turbulência. A força decai junto com o espalhamento da corrente e fica limitada à água conectada à foz. A perturbação é um efeito procedural de superfície.

A geração de hidrologia 2 usa a cota de drenagem no eixo do rio e preserva o nível da água que o recebe. As nascentes começam rasas e estreitas e ganham largura e profundidade ao longo das primeiras 16 células. A geração descarta ramos isolados muito curtos que terminam no lago. A regra corrige as manchas na margem sem remover tributários de um canal maior. Pontes geradas exigem pelo menos 0,25 m de profundidade no eixo do rio para evitar travessias sobre o começo raso da nascente.

A hidrologia 3 dá aos canais uma lagoa de cabeceira com saída para jusante. Com o controle de lagos zerado, a geração mantém os córregos sem lagoas. Nos mapas de até 768 m, as lagoas usam a área já molhada para preservar espaço para povoados. No mapa de 5.000 m, o alargamento gradual ocorre ao longo de até 235 passos na grade, cerca de 235 a 332 m conforme a direção. O canal continua pela drenagem até outro rio, lago ou mar. Uma vazão maior pode gerar lagoa e canal mais largos. A geração de recursos favorece árvores e pedras nos primeiros 16 m ao redor da lagoa, usando as espécies do bioma e respeitando estradas, lotes e a configuração de vegetação.

A hidrologia 4 aprofunda o leito na conexão com o lago ou mar usando a faixa de influência da corrente. A profundidade diminui nas laterais e ao longo do espalhamento, produzindo uma passagem de cor mais escura. A corrente deforma as ondas da água receptora e perde influência gradualmente. As matas das nascentes recebem árvores maduras em uma segunda distribuição local, com IDs `st:`, respeitando bioma, terra firme e ocupação. As copas podem se sobrepor nessa área.

O formato do save continua na versão 1. Como o terreno e a localização dos povoados podem mudar, o jogo abre automaticamente a versão de geração mais recente com save existente, ou usa a hidrologia 8 para um mundo novo. Para comparar, acrescente `hydrology=1`, `hydrology=2`, `hydrology=3` `hydrology=4` ou `hydrology=5` à URL. Cada geração mantém progresso separado e a versão 1 conserva a chave original.

## Executar e verificar

Use Node.js 24 e um navegador com WebGL 2. Rode `npm ci` (a dependência Git direta está autorizada em `.npmrc`) e `npm run dev -- --port 5917`. Abra [o servidor local](http://127.0.0.1:5917/). A semente 1769 abre a vila com ponte.

Use `npm test`, `npm run build`, `npm run playtest` e `npm run benchmark:placement`. O playtest usa Chrome instalado ou Edge com `KINGDOM_BROWSER=msedge`. A variável `KINGDOM_URL` permite usar um servidor já aberto. Os relatórios ficam em `playtest-output/`.

### Apresentação atual

O botão Primeira pessoa oferece navegação de câmera à altura dos olhos com WASD e mouse; Esc retorna ao mapa. Colisões físicas com construções continuam pendentes.

`src/render/pixel-art.js` aplica nearest, cores em degraus, contornos por profundidade e dithering suave. `src/render/resolution.js` mantém 150% das dimensões CSS na vista distante em crisp/balanced e sobe progressivamente até 200% ao aproximar de span 43 m para 20 m. Atlas usa 100% a 150%. Primeira pessoa usa o limite próximo. A densidade avança em passos de 1/12 e só realoca os alvos quando suas dimensões mudam. Animais continuam com qualidade low e LOD 2; duas aparências por espécie reutilizam a construção, preservando IDs e sementes individuais no estado.

A água identifica o rio por `waterRiver`, independente do cancelamento dos vetores nas curvas. A espuma de correnteza usa manchas suaves, preservando o acabamento dos lagos. As ondas costeiras misturam sinais com máscaras espaciais para interromper as frentes. A faixa visual de praia chega a 14 m nas costas baixas, com menos vegetação junto ao mar. O relevo e as chaves de save são preservados.

### Piloto de modelos de natureza

A apresentação próxima usa 19 modelos preparados do Ultimate Nature Pack by Quaternius para quatro famílias de árvores e três rochas. Os modelos importados são compartilhados entre as distâncias; acácias permanecem procedurais. O [registro da integração](pacote-natureza.md) descreve a conversão, os contratos preservados e a validação visual pendente.


### Otimização da apresentação ampla

A vegetação usa lotes em células de 64 m e índices LOD derivados dos modelos
importados. Animações de fauna são distribuídas em fases, com cadência menor
apenas para animais pequenos e afastados. Consultas assíncronas de GPU podem
limitar o supersampling distante entre 125% e 150% quando houver pressão
medida; a qualidade próxima é preservada. Estado, recursos e consultas seguem
os chunks de 32 m. [Medições e reprodução](otimizacao-render.md).

### Biomas de vegetação compatíveis

O jogo distribui as 94 árvores do pacote por oito perfis de flora sobre os
biomas existentes. Também usa as 21 pedras e os modelos de arbustos, flores,
cactos, gramíneas, cultivos, tocos e troncos. Inclui palmeirais quentes,
variantes frias e árvores secas raras, com seleção regional determinística.
Os recursos base e os saves são preservados. [Regras, compatibilidade e
validação](biomas-vegetacao.md).

### Correção da distribuição por habitat

A família visual agora depende do clima regional conservado do gerador e da proximidade de água doce. A espécie legada permanece como identidade de recurso para preservar saves e ocupação. A correção altera a aparência ao regenerar a mesma semente, preservando os pontos e IDs. [Distribuição e validação](biomas-vegetacao.md).

### Vegetação rasteira texturizada do MegaKit

O jogo incorpora 19 geometrias preparadas do MegaKit Standard; 12 modelos verdes entram na distribuição. Flores e cogumelos coloridos ficam sem posicionamento, e a folhagem recebe base verde com amarelecimento por calor. O atlas compartilhado preserva UV e recortes alpha. A composição artificial de dez cópias foi removida; plantas têm posições, dimensões e alturas próprias. Consulte [biomas de vegetação](biomas-vegetacao.md) para reprodução e limites. A integração de árvores dos novos pacotes permanece pendente.

### Traçado dos rios: hidrologia 5

A geração 5 introduziu o traçado curvo descrito abaixo; mundos novos usam agora a geração 8. `src/world/terrain/relief.js` acrescenta uma deformação local dos vales; `drainage.js` desempata a propagação em planícies com custo espacial coerente, mantendo a cota física separada da prioridade. `hydrology.js` desloca suavemente o eixo escavado e varia a largura das margens em até 18%. O deslocamento é limitado para manter o eixo autoritativo molhado; nascentes e encontros continuam ligados pela drenagem. A direção de corrente consultada continua quantizada nas oito direções da grade.

Compatibilidade: o formato de save permanece na versão 1. As gerações 1–4 conservam o algoritmo anterior; a seleção automática mantém a geração mais recente com progresso salvo. A geração 5 pode mudar relevo, povoados e locais de recursos, portanto usa sua própria chave de progresso. Para experimentar explicitamente, use `hydrology=5` na URL; para voltar, use a geração anterior. Os testes com coordenadas históricas ficam explicitamente na geração 4.
### Nascentes nos lagos: hidrologia 6

A geração 6 introduziu as origens em lagos; a geração atual é a 8. `src/world/terrain/lake-outlets.js` seleciona uma saída por lago interior conectado, priorizando a maior vazão. Toda a bacia precisa ficar afastada do mar por pelo menos 8% do tamanho do mapa, com limites de 12 e 100 m. A distância usada é conservadora na grade. Apenas saídas com vazão suficiente para o controle de rios e drenagem confirmada até o mar entram na rede.

O canal começa na saída do lago e segue o estado autoritativo até o mar, atravessando outros lagos e compartilhando trechos após confluências. Não há nascentes independentes em terra nem novas lagoas artificiais de cabeceira. Sem lagos ou com rios desativados, não há canais. `headwaters` conserva os índices das origens, agora dentro dos lagos; `headwaterPonds` é zero e `lakeOutlets` registra a quantidade de origens. As curvas da geração 5 permanecem.

O formato do save continua na versão 1. As gerações anteriores, inclusive a 5, preservam seus algoritmos e chaves; o carregamento automático mantém a geração com progresso. A geração 6 tem progresso separado porque a nova rede pode deslocar povoados e recursos. Use `hydrology=6` na URL para experimentar explicitamente e o número anterior para retornar.
### Regiões frias sem água doce: hidrologia 7

A geração 7 exclui lagos inteiros que tocam regiões de temperatura abaixo de 0,44 ou altitude normalizada acima de 20 m, cobrindo a faixa boreal e as altitudes de tundra/neve. `src/world/terrain/cold-water.js` calcula uma margem conservadora de 7 m ao redor dessas regiões. A classificação usa o relevo e a temperatura antes da escavação, evitando dependência circular dos biomas.

O gerador só aceita saídas de lagos cujo percurso completo ao mar evite essa faixa. As margens escavadas também respeitam a máscara. Assim, um rio não é cortado no meio ao encontrar frio; a origem incompatível é descartada. O mar permanece permitido. As gerações anteriores conservam seus algoritmos, e os saves com progresso continuam na geração original; a geração 7 tem sua própria chave. Use `hydrology=7` na URL para experimentar.
### Biomas em regiões contínuas: geração 8

`src/world/ecology.js` troca o ruído dominante de 14 m por massas climáticas deformadas com escala de 18% do mapa, limitada entre 90 e 420 m. A variação regional de umidade pesa 0,115; uma segunda escala de 29% da principal pesa 0,028; o detalhe de 19 m pesa apenas 0,006. Isso mantém grandes manchas, recortes e clareiras menores sem distribuir ilhas de tamanho semelhante por toda a planície. O clima, a altitude, o declive e a proximidade da água continuam decidindo os biomas. Não há alteração no shader nem na paleta.

A geração 8 mantém relevo, rios e lagos da 7. Como biomas afetam vegetação e ocupação, utiliza progresso separado. As gerações anteriores preservam seus algoritmos e saves; o carregamento automático conserva a geração com progresso. O formato de save permanece na versão 1. Novos mundos usam a 8; a URL aceita `hydrology=8` para conferir explicitamente.
### Texturas do terreno

`src/render/terrain-textures.js` e `src/render/materials.js` aplicam o atlas de oito texturas fornecidas pelo usuário ao terreno, em coordenadas globais com repetição de 8 m. Dois atributos de quatro pesos por vértice permitem misturar biomas, praias, declives, campos, pátios e estradas nas bordas. A cor do bioma e a iluminação continuam ativas. Nearest mantém os detalhes próximos; mipmaps e atenuação entre pegadas de 2 e 8 texels reduzem cintilação e repetição ao afastar. A textura é descartada junto com o material.

| Camada | Origem | Uso |
| --- | --- | --- |
| 0 | grass (1).png | Pradaria, floresta temperada e mata ciliar |
| 1 | grass (4).png | Savana |
| 2 | leaves.png | Mata densa e pântano |
| 3 | dirt (2).png | Leitos expostos, região seca, campos, pátios e caminhos de terra |
| 4 | g_pal_00_color.png | Areia de margens e praias |
| 5 | snow.png | Neve |
| 6 | grass snow.png | Tundra |
| 7 | road.png | Piso mineral, montanhas e pavimentação |

`python tools/prepare-terrain-textures.py 'C:\Users\Julio\Downloads\Terrain Textures'` gera o atlas 1088 × 544, com imagens reduzidas para 256 × 256 e bordas repetidas de 8 pixels. Os nomes e hashes ficam no manifesto. O atlas usa o caminho-base do Vite para funcionar em subdiretórios. As outras 11 imagens fornecidas não entram no runtime nesta etapa. Não há mudança de geração, biomas, geometria física, IDs ou saves. A origem e a ausência de licença no material fornecido estão registradas nos avisos de terceiros.
### Água NVJOB: apresentação atual

`src/render/water.js` adapta o shader Unity `Water Surface.shader` do #NVJOB Simple Water Shaders v1.6 para GLSL/Three.js. Usa dois albedos, dois mapas normais e um mapa de altura originais. A adaptação conserva camadas com velocidades distintas, micro-ondas por normal mapping e deslocamento aparente por altura; combina profundidade, transparência de margem, brilho especular e Fresnel. A cor-base é azul-petróleo/verde para integrar o mapa. O efeito é de superfície: não desloca fisicamente o nível nem o terreno.

`src/render/water-geometry.js` usa os mesmos triângulos, recorte de margem e interpolação da consulta autoritativa. Um pequeno deslocamento visual de 0,012 m evita conflito de profundidade. O shader segue a direção de jusante dos rios; lagos têm deriva lenta e o mar uma escala maior de textura. Uma faixa estreita de espuma varia com a profundidade. As quatro faixas do oceano externo ficam fora do quadrado do mapa. A malha de água participa da seleção; a inspeção continua consultando o estado. A ondulação da travessia reaproveita o ponto de integração `waterRipple`.

O material e as cinco texturas são compartilhados pelos chunks e descartados ao destruir a visualização. A captura da cena para refração, o editor de materiais e as cenas de demonstração Unity não foram portados. A revisão atual acrescenta reflexão planar dos lagos com Reflector do Three.js, descrita abaixo. A integração não altera versão de geração, regras aquáticas, IDs ou saves.

Reprodução: `python tools/prepare-nvjob-water.py 'C:\Users\Julio\Downloads\nvjob-water-shader-simple-and-fast-master\nvjob-water-shader-simple-and-fast-master'`. As imagens são copiadas sem conversão para `public/water/nvjob/`; o manifesto registra nomes, tamanhos e hashes. As licenças MIT de NVJOB e Unity acompanham os recursos; veja os avisos de terceiros.
### Padrões de movimento e transições da água

`src/render/water-motion.js` suaviza as oito direções de drenagem com amostras vizinhas de água corrente na mesma cota. Nas águas receptoras, reutiliza `mouthFlow` e os candidatos de `index.riverMouths` por chunk para estender a corrente por água conectada, com espalhamento lateral, progressão e perda de intensidade. `water-geometry.js` guarda esses dados nos vértices e reaproveita cada amostra dentro do chunk. O recorte e as cotas da superfície continuam os mesmos.

O shader distingue três padrões: rios com filetes direcionais; lagos com ondulação curta e fraca; mar com duas frentes de ondas em direções e comprimentos diferentes. A influência da corrente atenua as ondas receptoras, acrescenta pequenas perturbações laterais e espuma de mistura e perde força ao longo da foz. O mar tem faixa de quebra rasa modulada pelas ondas. Os movimentos são normais/cores de superfície, sem deslocar fisicamente o nível da água.

A advecção usa dois ciclos sobrepostos de oito segundos. Cada fase é reiniciada enquanto está oculta pela outra, evitando saltos no reinício e deslocamento ilimitado das texturas em curvas. As coordenadas mundiais são compartilhadas entre canal e receptor. O relógio continua respeitando movimento reduzido. Não houve mudança na hidrologia, geração, IDs, saves ou regras de travessia. O campo visual estendido não altera a deriva física dos personagens nos lagos e no mar.
### Lagos calmos e arrebentação costeira

O material reduz a deriva, o parallax, o contraste de textura e a intensidade das normais nos lagos fora das fozes. Perturbações ambientais esparsas geram anéis que se propagam radialmente e perdem amplitude perto das margens. São perturbações visuais de brisa, sem novos eventos de peixe ou lançamento de pedras. As ondulações existentes da travessia permanecem. Nas margens de lago não há espuma de arrebentação; uma pequena variação de transparência sugere vaivém.

`src/render/water-reflections.js` mantém um único reflexo planar do lago próximo ao foco, com Reflector do Three.js, alvo 384 × 384 sem multisampling e no máximo oito atualizações por segundo. A água é ocultada na passagem refletida, que usa fundo de céu claro. Visibilidade, fundo e atualização pendente das sombras são restaurados. O shader aplica o reflexo somente à cota correspondente, com perda gradual nas bordas da captura; outros níveis conservam o acabamento de cor/Fresnel. Os recursos são descartados junto da visualização.

No mar, duas ondulações largas continuam em água profunda. O gradiente da profundidade orienta a frente costeira em direção ao raso; a onda fica visualmente mais curta e acentuada antes da faixa de quebra. A espuma branca depende de fase e profundidade. `swashGeometry` acrescenta uma película apenas em areia costeira baixa, até cerca de 0,3 m acima do nível estático e dentro de três células do mar. O mesmo ciclo da faixa de quebra determina avanço, recuo e uma borda fina de espuma sobre a areia.

A película não recebe seleção nem muda a máscara física da água. A apresentação não muda relevo, hidrologia, nível autoritativo, velocidade da travessia, IDs ou saves. Ondas oceânicas continuam sendo um efeito de normais e cor; não são uma simulação volumétrica ou deslocamento geométrico do oceano. Praias altas e paredões ficam fora da película.
### Arrebentação orgânica: distância real à costa

`seaShoreDistance` em `src/render/coast.js` prepara um campo visual de distância à terra seca numa grade de 2 m, com duas passagens chamfer de vizinhos axiais/diagonais e precisão de 0,1 m armazenada em Uint16. A interpolação fornece o atributo `shoreDistance` dos vértices aquáticos; margens recortadas recebem distância zero. O oceano externo recebe 128 m, ficando fora da arrebentação. Nenhuma grade autoritativa é modificada.

`src/render/coastal-waves.js` define três frentes com alcance/período/largura distintos: 9,5 m/7,7 s/0,65 m; 15,2 m/18,7 s/1,05 m; 20,5 m/11,9 s/1,4 m. A razão entre velocidades extremas é superior a 2. O ruído de valor contínuo com interpolação quíntica deforma a distância da frente, sua largura, fase e cobertura. Duas escalas de cobertura interrompem as cristas em segmentos irregulares, evitando linhas contínuas e pontos em grade.

A normal costeira vem do gradiente desse campo, acompanhando enseadas e saliências. Cristas claras e espuma ficam na faixa de distância que desaparece entre 12 e 24 m da costa e na água rasa que desaparece entre 1,2 e 3 m de profundidade. Fora dessa faixa, o mar conserva apenas ondulação fraca, baixo contraste de albedo e brilho especular reduzido. As antigas faixas claras de senoide diagonal foram removidas. O mar profundo fica opaco para não expor a junção retangular entre terreno submerso e fundo externo.

O avanço e recuo da película de praia usam os mesmos ciclos costeiros. O cálculo das frentes é omitido nos fragmentos fora da arrebentação e da película. Lagos, rios, reflexos, fozes e dados de geração continuam com seus contratos anteriores. A grade de distância acrescenta aproximadamente 12,5 MB num mapa de 5 km; o atributo acrescenta quatro bytes por vértice de água.

Na espuma, a cobertura agora é amostrada em células fixas de cerca de 0,24 m, com interrupções de ruído e variação de cor agrupadas em manchas de várias células e quatro níveis discretos de crista. Uma paleta curta mantém variação de luz sem borrar os blocos. Essa quantização altera apenas a apresentação da espuma marítima; a película sobre a areia e os limites físicos da água permanecem iguais.

### Hidrologia 9: lagos conectados ao mar
Todo lago retido precisa de rota de drenagem ate o mar sem atravessar regioes frias. Saidas nao dependem mais de vazao minima ou distancia da costa. Todos os ramos de saida sao esculpidos; bacias sem rota valida sao descartadas. Com rios desativados, nao ha lagos nesta versao. Versoes 1 a 8 e saves anteriores permanecem disponiveis; a versao 9 tem chave propria e pode mover vegetacao e assentamentos. Testes de conectividade em tres sementes e testes de regioes frias aprovados. Build aprovado. Navegador carregou sem erros; inspecao visual completa do streaming e das fozes pendente.

### Lagos afastados da costa e depressoes interiores
Hidrologia 9 exige afastamento minimo de 8% do tamanho do mapa, limitado entre 12 e 100 m. Apenas terreno baixo conectado a borda por vizinhos cardinais e considerado oceano. Depressoes interiores abaixo do nivel do mar entram na drenagem a 0,13 m acima do mar, permitindo continuidade do canal. A entrada original nao e alterada. Testes cobrem afastamento, falso oceano interior e continuidade de saidas. A transparencia permanece igual.

### Estuario e erosao da foz
Na hidrologia 9, canais baixos ampliam gradualmente a meia-largura ate 3,2 vezes nos ultimos 32 m da costa. O leito aprofunda progressivamente ate cerca de 3,35 m no eixo da embocadura; o aprofundamento existente da pluma marinha recebe alvo maior com queda lateral e longitudinal. A influencia da corrente junto da profundidade suprime a arrebentacao na boca, mantendo praias laterais. Build e testes de drenagem, movimento e malha aquatica aprovados. Navegador sem erros de shader observados; aprovacao visual especifica de todas as fozes pendente.

### Corredor final do estuario
carveEstuary executa apos as demais escavacoes e antes da ecologia, cortando terreno, mascara e superficie conjuntamente. Corredor desde 24 m a montante ate pelo menos 36 m no mar, com rampas longitudinais e laterais, profundidade alvo de 3,6 m. Substitui o aprofundamento marinho isolado anterior. A faixa recebe classificacao marinha compartilhada e os caminhos de mistura sao recalculados. Teste sintetico verifica corte continuo de barreira de areia e preservacao de terreno lateral. Testes de agua/drenagem e build aprovados antes da remocao final do aprofundamento antigo; teste do corredor aprovado apos essa remocao. Conferencia visual especifica da foz pendente.

### Dissolucao da ponta do estuario
O corredor usa decaimento radial eliptico na ponta marinha e variacao coerente lateral por duas senoides, dissolvendo a escavacao no fundo existente. A malha compartilha um fator continuo entre comportamento fluvial e marinho ao longo de 44 m na foz, em vez de chave binaria. Cor e textura usam a mesma mistura de material; a transparencia aprovada continua baseada em profundidade. Oito testes focados aprovados e build aprovado. Conferencia visual da foz pendente.

### Correnteza e canal marinho alongados
O alcance da foz marinha foi multiplicado por quatro; escavacao radial e caminho de corrente usam esse alcance. A mistura curta de 44 m foi substituida pelo peso continuo da pluma, com perda longitudinal e lateral. A corrente marinha estendida tambem cobre os 40 m anteriores a boca, recuperando adveccao e textura fluvial no trecho reclassificado como mar. O peso controla a contribuicao do material do rio sobre o oceano compartilhado, sem abrir transparencia no fundo. Oito testes focados e build aprovados. Conferencia visual especifica em movimento pendente.

### Margens arredondadas e abertura em leque
carveEstuary usa ombros de largura com smoothstep de -24 a 12 m e abertura marinha adicional de 0,18 m por metro, introduzida suavemente. Duas escalas de variacao lateral removem paralelismo. O limite abrupto de altura da areia foi substituido por atenuacao entre 1,5 e 4 m; a mascara de margem acompanha a profundidade escavada, evitando uma faixa molhada larga com fundo quase seco. Oito testes focados e build aprovados. A conferencia visual dos dois cantos na semente 1769 continua pendente.

### Mistura lateral da agua na foz
Peso de lago corrigido para max(0, 1-sea-river): os pesos complementares de rio e mar antes ativavam indevidamente o acabamento de lago na faixa intermediaria. A contribuicao fluvial na pluma marinha recebe interpolacao cubica, atenuando as bordas laterais. Terreno e transparencia por profundidade permanecem iguais. Sete testes de malha/movimento e build aprovados; conferencia visual dos cantos pendente.

### Cantos marcados na margem da foz
A escavacao lateral agora interpola a altura existente ate o fundo alvo pelo peso continuo de erosao. Antes, qualquer peso positivo colocava imediatamente a areia abaixo do nivel do mar, produzindo cantos no recorte. A mascara umida acompanha a profundidade efetiva apenas nos pontos submersos. Quatro testes focados e build aprovados; navegador sem erros registrados. A correspondencia visual com os dois pontos marcados ainda precisa ser conferida.

