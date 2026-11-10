# Instruções para agentes

Este repositório começa pela documentação do Kingdom · Atlas Vivo. A etapa atual e a próxima entrega estão em [Protótipo e migração](docs/prototipo-e-migracao.md). Antes de editar regras de jogo, leia o [GDD](docs/gdd.md) e a [arquitetura-alvo](docs/arquitetura-alvo.md). Para mudanças de desempenho, siga [Validação](docs/validacao.md).

## Contratos de trabalho

- Confirme o estado real dos arquivos. Separe o que existe no protótipo, o que foi aprovado como direção e o que ainda é hipótese.
- Faça alterações pequenas. Preserve sementes, IDs, saves e regras observáveis ou documente a migração e cubra-a com testes. Registre a justificativa de mudanças nos contratos.
- Mantenha regras de jogo testáveis sem navegador, DOM ou Three.js. A interface envia intenções. O estado confirma resultados. A apresentação consome os resultados.
- Prefira catálogos, dados e capacidades reutilizáveis. Use classes para responsabilidades com ciclo de vida, como estado do mundo e visualização. Introduza módulos de domínio junto com regras concretas.
- Em cada comando, revalide alvo e condições no estado autoritativo. Aplique conjuntamente mudanças que preservam uma invariável. Emita fatos depois da confirmação. Mantenha o encadeamento de reações limitado e rastreável.
- Em caminhos frequentes, conte candidatos visitados e trabalho efetivo. Use consultas locais e agendamento por atividade. Baseie a adoção de ECS completo e Workers persistentes em medições representativas.
- Preserve os controles, o estilo medieval e a legibilidade do mapa ao migrar o protótipo. Use referências públicas como inspiração e mantenha atribuições de código e recursos incorporados.
- Confira o conjunto de arquivos preparado antes de cada commit. Nesta etapa, publique somente os documentos aprovados. Ao importar o código, inclua manifesto, lockfile e avisos de terceiros pertinentes. Mantenha dependências instaladas, builds, capturas e saves locais fora dos commits.

## Verificação

Para mudanças documentais, confira links, instruções e coerência entre escopo e estado. Após a importação do código, rode os testes relevantes e, para mudanças jogáveis, faça o teste no navegador. Registre os comandos executados, o resultado e as verificações pendentes na entrega.
