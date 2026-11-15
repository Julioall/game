# Otimização da apresentação no zoom amplo

## Implementação

- Vegetação: instanciamento por células de 64 m, reunindo até quatro chunks.
  O estado autoritativo, as consultas, a coleta e os saves continuam em 32 m.
  Apenas células alteradas são refeitas, até duas por quadro; liberação das
  instâncias não descarta geometrias compartilhadas. Sombras e construções
  conservam seus lotes atuais.
- Modelos: `tools/prepare-nature.mjs` prepara índices distantes com MeshoptSimplifier
  incluído no Three.js. Atributos de posição, cor e superfície são preservados.
  O alvo é 55% dos triângulos, limitado por erro ponderado de 2%. As árvores
  atingiram cerca de 45% de redução. Cores e classes de material participam da
  métrica. Rochas com maior erro mantêm mais triângulos. O banco mantém caches
  distintos perto/longe, com a mesma variante e dimensões de referência.
- Animais: fases derivadas do ID distribuem atualizações entre quadros. A
  acumulação conserva tempo de animação, independentemente do tick autoritativo.
  A cadência máxima permanece em 60 Hz perto, 30 Hz no mapa amplo; apenas espécies
  pequenas, com span a partir de 90 m e a mais de 35% desse span do foco, usam
  até 20 Hz. Não há remoção de indivíduos por teto de população.
- Partes dos animais: `setCoverings` da biblioteca desliga as camadas de pelagem
  e aletas de silhueta quando o tamanho estimado fica abaixo de 16 pixels CSS
  na vista ampla. O corpo, rig e olhos permanecem; a cobertura retorna de perto.
  É uma estimativa a partir do espaçamento da espécie, não uma caixa de tela exata.
- GPU: consultas assíncronas EXT_disjoint_timer_query_webgl2 amostram um em cada
  quatro quadros, sem esperar resultados. Amostras disjoint são descartadas.
  Sem extensão, o diagnóstico informa indisponibilidade e a resolução não baixa.
- Supersampling: depois de 30 observações novas em cena estabilizada, só reduz
  se GPU média exceder 7 ms e superar o tempo de CPU do draw em 15%. O teto
  distante desce de 150% até no mínimo 125%, em passos de 1/12; recupera se GPU
  ficar abaixo de 4,5 ms. Não reduz a qualidade próxima/primeira pessoa. O tempo
  CPU do draw não inclui toda a simulação executada em main.js e o timer GPU
  não representa outras abas, composição do desktop ou custo de apresentação.

Os contratos da simulação, sementes, população, IDs, inventários e versão dos
saves permanecem iguais. A água foi removida em outro recorte e não está presente
nestes dois cenários de comparação.

## Comparação controlada

Teste no navegador local, semente 1769, foco (527, 557), span 111,375 m,
janela 1280 × 720 e resolução interna 1920 × 1080, detail balanced. As duas
rodadas usaram 78 modelos carregados, fila vazia, nenhuma falha e fauna congelada
no estado inicial para manter posições/população equivalentes. A animação idle
continuou ativa. Cada amostra de FPS foi coletada durante 2,5 s depois da fila
terminar; o diagnóstico usa janela móvel de até 150 quadros. CPU/GPU são médias
móveis, não percentis do mesmo intervalo. Apenas uma amostra por configuração.

| Medida | Referência | Otimizado |
| --- | ---: | ---: |
| FPS médio | 87,4 | 141,1 |
| Quadro p95 | 20,9 ms | 7,1 ms |
| Chamadas de desenho | 711 | 421 |
| Triângulos por quadro | 11.488.942 | 3.819.792 |
| CPU do draw | 8,76 ms | 5,20 ms |
| GPU medida | 10,18 ms | 3,40 ms |
| CPU do adaptador de fauna | 2,36 ms | 1,32 ms |
| Modelos carregados / fora da cena | 78 / 36 | 78 / 36 |
| Resolução interna | 1920 × 1080 | 1920 × 1080 |

O controlador manteve o supersampling em 150% no teste otimizado. O ganho medido
não veio de reduzir resolução. Chamadas caíram cerca de 41% e triângulos cerca de
67%, combinando lotes, LOD e retirada de coberturas pequenas. A comparação
não permite atribuir uma porcentagem individual a cada técnica nem garante
144 FPS em qualquer região/hardware, especialmente durante geração/downloads.
A identificação de CPU/GPU pelo sistema não ficou disponível (consulta CIM
bloqueada); não foi registrado modelo de hardware para extrapolar resultados.
É necessária uma rodada maior em cenas densas, caminhada e hardware móvel.

## Reproduzir

Use o mesmo servidor, janela e hardware. As chaves de teste só são aceitas com
qa=1 e são removidas ao voltar à URL normal:

- Referência: `/?qa=1&seed=1769&renderBaseline=1&freezeFauna=1`.
- Otimizado: `/?qa=1&seed=1769&freezeFauna=1`.

Clique cinco vezes em Afastar a partir da vila inicial. Espere faunaPending,
faunaQueued e vegetationPending zerarem. `window.kingdomQA.stats()` expõe os
contadores e `resetFrames()` limpa a janela de tempos. O modo de referência
reconstitui o instanciamento por chunk, as geometrias completas, a cadência sem
fase e coberturas anteriores; não é um checkout histórico de todo o jogo.
freezeFauna interrompe apenas o tick de fauna na aba de teste; nenhum save muda.

O runtime normal não usa essas chaves. Para o pipeline offline:

```powershell
node tools/prepare-nature.mjs 'C:\caminho\Ultimate Nature Pack by Quaternius'
npm test
npm run build
```

## Verificação

47 testes aprovados: redução dos índices e preservação de atributos/limites,
lotes de chunks vizinhos, atualização após coleta/visibilidade, descarte sem
invalidar geometria compartilhada, distribuição de fases, seleção dos 20 Hz,
conservação de dt, política GPU, consultas sem bloqueio e descarte disjoint.
Build aprovado, com aviso preexistente de tamanho do bundle. Capturas perto e
longe conferidas no navegador. As amostras de teste ficam fora dos commits.


### Verificação adicional com simulação normal

Na mesma câmera e resolução, com a fauna voltando a se deslocar, uma amostra
posterior de 2,5 s registrou 141,15 FPS, p95 de 7,1 ms, 439 chamadas, 4.002.710
triângulos, 85 modelos carregados, 37 fora da cena, fila vazia e zero falhas.
CPU do draw: 5,01 ms; GPU média: 5,31 ms; CPU do adaptador: 1,24 ms.
O teto continuou em 150%. A população local mudou com o deslocamento; essa
amostra confirma funcionamento, mas não integra o par controlado da tabela.
Nenhum erro novo foi encontrado no console nessa rodada; mensagens anteriores
à correção de células vazias no desenvolvimento não foram contadas como atuais.
A aba temporária de benchmark não altera a aba de jogo do usuário e não grava
mudanças nos saves ao usar o congelamento de fauna.
