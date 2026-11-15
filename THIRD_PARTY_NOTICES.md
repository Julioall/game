# Avisos de terceiros

## three.js Procedural Animals

O jogo usa `procedural-animals` para gerar e animar os modelos de fauna próximos da câmera. O manifesto fixa a revisão `c95ae49346aa8e140a924376cec6cf0073d99512` do repositório [threejs-procedural-animals](https://github.com/majidmanzarpour/threejs-procedural-animals), de Majid Manzarpour e colaboradores.

Licença MIT. O texto integral está em [`public/third-party/procedural-animals-LICENSE.txt`](public/third-party/procedural-animals-LICENSE.txt) e também acompanha o pacote instalado em `node_modules/procedural-animals/LICENSE`.

## Kingdom Fauna Lab

Os nomes de espécies e pesos de habitat em `src/world/fauna-catalog.js` foram adaptados do arquivo `Kingdom_Fauna_Lab_v0.6.1_Stabilization.zip`, fornecido para integração pelo usuário. O motor de modelos e animações permanece a dependência MIT indicada acima. Benchmarks e atlas do laboratório não foram incorporados.

## Stylized Nature MegaKit Standard by Quaternius

O jogo prepara 19 modelos de vegetação rasteira do pacote Standard fornecido pelo usuário, sob CC0 1.0 Universal. A distribuição atual usa 12 modelos verdes: quatro gramas, dois trevos, uma samambaia, quatro plantas e um arbusto. Flores coloridas, arbusto florido e cogumelos ficam preparados, sem posicionamento. Seis texturas de cor foram reduzidas e reunidas num atlas com transparência. A licença fornecida está em [Quaternius-MegaKit-CC0.txt](public/third-party/Quaternius-MegaKit-CC0.txt). `tools/prepare-megakit-plants.mjs` e `tools/prepare-megakit-atlas.py` reproduzem a conversão. As árvores e demais modelos do MegaKit e o pacote Textured Stylized Trees de 2020 ainda não foram incorporados.

## Ultimate Nature Pack by Quaternius

O jogo incorpora 150 modelos do pacote fornecido pelo usuário: 94 árvores, 21 pedras e 35 itens de vegetação/decorativos. Licença declarada: CC0 1.0 Universal. O texto fornecido está em [Quaternius-Nature-CC0.txt](public/third-party/Quaternius-Nature-CC0.txt). Conversão, escopo e limites estão em [Pacote de natureza](docs/pacote-natureza.md).

As 48 malhas em `public/fauna/` são geradas pelo motor procedural-animals na revisão MIT acima, com qualidade low e sementes 1769/1770. O manifesto registra hashes e origem; `tools/prepare-fauna.mjs` reproduz a conversão para o formato bake fornecido pela biblioteca.

A preparação offline dos índices LOD usa MeshoptSimplifier (meshoptimizer 1.1), incluído no Three.js: copyright 2016–2026 Arseny Kapoulkine, licença MIT. O simplificador não é incorporado ao runtime do jogo; a instalação de desenvolvimento conserva o código e a declaração de licença da dependência.

## Terrain Textures — arquivos fornecidos pelo usuário

O usuário forneceu a pasta `C:\Users\Julio\Downloads\Terrain Textures` e solicitou sua integração ao mapa. O jogo incorpora oito imagens derivadas desse material em `public/terrain/terrain-atlas.png`. `public/terrain/manifest.json` identifica cada nome de origem e SHA-256; `tools/prepare-terrain-textures.py` reproduz a preparação. A pasta fornecida não contém licença nem indicação de autoria. Não se presume CC0 nem outra licença dos demais pacotes do projeto; os direitos e condições de redistribuição deste material não foram identificados.
## #NVJOB Simple Water Shaders v1.6

Adaptação do shader `Water Surface.shader` de #NVJOB Nicholas Veselov (copyright 2016 #NVJOB; raiz do repositório copyright 2019 #NVJOB), com trechos derivados do Unity Standard Surface Shader (copyright 2016 Unity Technologies), ambos MIT. Fonte fornecida pelo usuário: repositório `nvjob-water-shader-simple-and-fast`, em `C:\Users\Julio\Downloads`. `src/render/water.js` porta as camadas de albedo/normal e o parallax para Three.js; geometria, fluxo e profundidade se integram ao jogo. São incorporados cinco PNGs originais dos exemplos de água. Não são incorporados o ambiente, palmeiras, pós-processamento ou outros assets de demonstração.

Notices: [NVJOB](public/water/nvjob/license_nvjob.txt), [Unity Technologies](public/water/nvjob/license_unity.txt), [licença da raiz](public/water/nvjob/LICENSE). `public/water/nvjob/manifest.json` registra hashes e nomes de origem. `tools/prepare-nvjob-water.py` reproduz a cópia. Projeto original: https://github.com/nvjob/nvjob-water-shader-simple-and-fast .
A reflexão de lagos usa `Reflector` distribuído em `three/examples/jsm/objects/Reflector.js`, sob a licença MIT do Three.js já incluída na dependência. `src/render/water-reflections.js` limita a resolução/cadência, seleciona a cota do lago e controla visibilidade e ciclo de vida da passagem refletida.