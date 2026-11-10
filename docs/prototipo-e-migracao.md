# Protótipo e migração

## Estado da primeira publicação

O repositório começa com design e arquitetura. O código do protótipo está no espaço de trabalho local de origem. As pastas abaixo descrevem esse protótipo e passam a existir no repositório quando forem importadas.

| Caminho local | Estado auditado |
| --- | --- |
| `src/world/` | Terreno, hidrografia, biomas, assentamentos, reinos, defesas, geração de recursos por chunk e regras de coleta e construção |
| `src/render/` | Three.js e WebGL 2, câmera livre, cache visual, instâncias, sombras e modelos procedurais de casas, pontes e castelos |
| `src/ui/`, `src/main.js` | Minimapa, seleção, interface DOM, comandos atuais e integração com a câmera |
| `src/platform/local-save.js` | Save local por configuração, com inventário, recursos removidos e construções novas |
| `test/world.test.js`, `tools/playtest.mjs` | Testes do mundo e teste de navegador com geração, câmera, coleta, cabana, recarga e interface móvel |
| `docs/`, `public/third-party/` | Pesquisa, evidências locais e avisos de terceiros a revisar na importação |

O mapa permite até 5.000 × 5.000 m. Há vilas, solares, castelos e grandes cidades. Casas têm geometria própria e palha nas áreas rurais. Coleta e cabana funcionam com câmera livre. Personagens controláveis, interiores, economia autônoma e combate pertencem ao plano. O Worker atual gera o mundo e encerra após transferir o resultado.

## Sequência de importação

1. **Inventariar o protótipo e registrar a linha de base.** Reexecutar os testes locais. Registrar sementes, saves, controles e resultados antes de alterar módulos. Confirmar dependências, avisos e atribuições. Separar artefatos de teste e builds dos arquivos de origem.
2. **Importar um recorte executável.** Incorporar código, manifesto, lockfile, assets usados, testes e avisos em um commit verificável. Preservar o protótipo até a importação ter paridade. Classificar diferenças entre a implementação e a arquitetura-alvo.
3. **Migrar consulta de ocupação e comandos.** Indexar construções, campos e defesas por área, mantendo as decisões de lote. Resolver coleta por identidade autoritativa. Preservar saves e verificar débito, ocupação e concorrência lógica. Conferir [critérios de validação](validacao.md).
4. **Entregar a cabana habitável.** Adicionar personagem, planta navegável, porta e visibilidade do telhado com uma referência espacial comum. Validar entrada, saída, alcance e persistência.
5. **Testar autonomia e escalar por evidência.** Introduzir uma tarefa de coleta com reserva, cancelamento e execução. Comparar o custo por atividade antes de escolher ECS completo ou um Worker de simulação.

Cada etapa termina com uma demonstração verificável. Atualize este inventário quando o código entrar e marque claramente os sistemas implementados. Uma mudança de ID, geração ou schema exige plano de compatibilidade e teste de saves anteriores.

## Executar depois que o código estiver presente

Use Node.js 24 e um navegador WebGL 2. Na pasta do protótipo, rode `npm ci` e `npm run dev -- --port 5917`. Abra [o servidor local](http://127.0.0.1:5917/). A semente 1769 abre a vila com ponte. Para validação, use `npm test`, `npm run build` e `npm run playtest`. O teste usa Chrome instalado, ou Edge com `KINGDOM_BROWSER=msedge`. A variável `KINGDOM_URL` permite usar um servidor já aberto. Os relatórios ficam em `playtest-output/`.

A inspeção anterior encontrou oito testes passando. Isso é evidência sobre o protótipo de origem. Repita a verificação na cópia importada.
