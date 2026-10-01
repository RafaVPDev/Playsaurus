# Tours guiadas modulares para sistemas complexos

**Objetivo:** documentar uma abordagem reutilizável para criar tours contextuais, seguras, versionáveis e orientadas por papel em sistemas com regras de negócio, permissões e dados reais.

**Origem:** abordagem aplicada no NasaMotor e generalizada para uso em outros produtos.

**Público-alvo:** Produto, UX, Engenharia, QA, Suporte e responsáveis funcionais.

**Status:** referência de arquitetura e boas práticas.

---

## Resumo executivo

A abordagem parte de uma decisão simples: **tour guiada não é automação de negócio**.

Uma boa tour explica o produto no contexto real, conduz o utilizador por superfícies seguras, respeita permissões e estados existentes e sabe lidar com a ausência de dados. Ela pode navegar, destacar elementos, abrir conteúdo de consulta e alternar vistas puramente visuais, mas não deve criar, editar, aprovar, pagar, publicar, sincronizar ou executar qualquer ação que altere o estado operacional do sistema.

Em vez de criar uma tour longa para cada papel, o conteúdo é dividido em **módulos independentes e versionáveis**. Os percursos por papel apenas compõem esses módulos. Assim, o mesmo módulo pode ser reutilizado por diferentes perfis sem duplicação.

> **Em uma frase:** construímos tours como uma camada de aprendizagem contextual e segura, composta por módulos reutilizáveis por papel, capaz de lidar com estados reais do sistema sem executar operações de negócio.

---

## 1. Problemas que este modelo resolve

- Onboarding diferente para cada papel sem duplicar o mesmo conteúdo em várias tours.
- Tutoriais longos divididos em módulos menores, independentes e versionáveis.
- Fluxos reais com listas vazias, permissões condicionais, carregamento assíncrono e rotas variáveis.
- Áreas sensíveis nas quais a tour precisa ensinar sem executar a operação.
- Continuidade entre sessões, retomada, revisão e atualização de módulos.
- Integração entre orientação contextual e documentação aprofundada.
- Manutenção mais simples quando a interface ou uma regra de negócio muda.

---

## 2. Princípios de desenho

### 2.1 Ensinar sem executar o negócio

A tour pode:

| Pode fazer automaticamente | Não deve fazer automaticamente |
|---|---|
| Navegar para uma rota segura | Criar ou editar dados |
| Rolar até um elemento | Guardar ou submeter formulários |
| Abrir um registo em modo de consulta | Aprovar ou rejeitar |
| Trocar separadores puramente visuais | Registar pagamentos |
| Abrir histórico, anexos ou detalhe | Fechar, reabrir ou cancelar operações financeiras |
| Fechar um modal de consulta | Publicar fluxos ou configurações |
| Mostrar uma explicação centralizada | Conceder ou revogar acessos |
| Abrir documentação em nova aba | Alterar papéis, saldos ou configurações |
| | Iniciar sincronizações ou processamento externo |

> **Regra prática:** se um clique pode modificar dados, gerar efeito financeiro, alterar permissões ou disparar processamento externo, a tour explica a ação, mas não a executa.

### 2.2 Trabalhar com dados reais existentes

Quando um passo precisa de um exemplo, a tour pode abrir um registo real que o utilizador já tem permissão para consultar.

Não criamos registos artificiais apenas para demonstrar uma funcionalidade.

Se o exemplo não existir, a tour deve explicar o conceito sem fabricar cenário.

### 2.3 Não depender de um estado perfeito

A aplicação real pode estar em qualquer um destes estados:

- lista vazia;
- ausência de histórico;
- dados incompletos;
- permissão parcial;
- elemento não disponível para aquele papel;
- carregamento mais lento que o esperado;
- rota diferente da prevista;
- modal já aberto ou fechado.

A tour precisa tratar esses cenários como parte normal do produto, e não como exceção improvável.

### 2.4 O utilizador pode abandonar a tour

Se a pessoa fechar, mudar de página ou interromper a experiência, o progresso é preservado.

Não há rollback de operações, retorno forçado de rota nem tentativa de prender o utilizador no fluxo.

### 2.5 Papel compõe percurso; módulo mantém identidade própria

O mesmo módulo não deve ser duplicado para cada papel.

Exemplo: Navegação, Despesas ou Delegações podem aparecer em mais de um percurso, mas continuam sendo o mesmo módulo, com a mesma versão e a mesma identidade.

---

## 3. Arquitetura

A biblioteca de tour é apenas a camada visual. A lógica do produto fica numa camada própria.

| Camada | Responsabilidade |
|---|---|
| **Catálogo de módulos** | Define chave, título, versão, rota principal, papéis, disponibilidade e estado de prontidão. |
| **Percursos por papel** | Compõem módulos existentes numa sequência adequada para cada papel/contexto. |
| **Definição da tour** | Declara passos, alvos, textos, rotas, condições, fallbacks e links de ajuda. |
| **Runner** | Navega, espera o DOM, posiciona o spotlight, trata ausências, pausa, retoma e conclui. |
| **Persistência** | Guarda progresso por utilizador, módulo e versão. |
| **Instrumentação da UI** | Expõe alvos estáveis com `data-tour` e marca ações protegidas. |
| **Base de conhecimento** | Fornece documentação aprofundada para o botão “Saber mais”. |

No caso de referência, o **Driver.js** foi usado como engine de spotlight/popover. A inteligência de produto ficou fora da biblioteca.

---

## 4. Módulos e percursos

### 4.1 Módulo não é sinónimo de tela

Um módulo representa um **conceito ensinável**.

Às vezes ele ocupa uma única página. Em outros casos, pode atravessar mais de uma rota. O recorte é pedagógico e funcional, não necessariamente igual à estrutura do menu.

### 4.2 Evitar a “mega tour por papel”

Em vez de uma única “Tour do Administrador” com dezenas de passos, dividimos o conteúdo em temas independentes.

Exemplo de composição:

- Navegação
- Despesas
- Aprovações
- Delegações
- Pagamentos
- Arquivo
- Empresas e acessos
- Utilizadores
- Centros de custo
- Categorias e subcategorias
- Aprovisionamento
- Consumo e processamento

Outro papel pode reutilizar apenas parte desses módulos.

### 4.3 Percurso por papel e exploração por tema

A mesma biblioteca de módulos pode ser descoberta de duas formas:

| Forma | Objetivo |
|---|---|
| **Percurso por papel** | Dar uma sequência orientada ao trabalho que a pessoa exerce. |
| **Explorar por tema** | Permitir rever ou consultar apenas um assunto específico. |

A ordem visual dos cards e tags pode ser alfabética para facilitar leitura. A sequência real de execução continua definida pelo percurso.

---

## 5. Segurança operacional

### 5.1 Ações de negócio protegidas

Além da regra editorial, as ações sensíveis devem ser marcadas tecnicamente na interface.

Exemplo conceitual:

```html
<button
  data-tour="payment.confirm"
  data-tour-business-action="true"
>
  Registar pagamento
</button>
```

O runner reconhece que aquele alvo representa uma ação de negócio e impede que a tour o trate como interação ativa.

### 5.2 Interações automáticas permitidas

Interações automáticas devem ser limitadas a ações de apresentação, por exemplo:

- mudar para uma aba apenas visual;
- abrir um painel de consulta;
- fechar um modal de leitura;
- navegar para uma rota;
- rolar até um alvo.

Essas interações precisam ser claramente sem efeito de negócio.

### 5.3 Regra para `beforeEnter`

`beforeEnter` pode preparar a interface para o passo, mas **nunca deve conter uma ação de negócio**.

Pode abrir uma aba de consulta. Não pode clicar em Guardar, Aprovar, Sincronizar, Dar acesso ou equivalente.

---

## 6. Estados imprevisíveis: `skip`, `explain` e `pause`

Cada passo deve declarar como reagir quando o alvo não existe.

| Fallback | Quando usar | Comportamento |
|---|---|---|
| `skip` | Passo opcional ou detalhe de baixa importância | Ignora silenciosamente e segue. |
| `explain` | O conceito é importante, mas não existe dado/elemento para mostrar | Mostra uma explicação centralizada, sem spotlight. |
| `pause` | Falta uma estrutura essencial ou a rota não está pronta | Pausa e preserva o progresso para retomada posterior. |

### 6.1 Por que `explain` é especialmente importante

`explain` permite ensinar sem inventar dados.

Exemplos:

- não existe uma despesa para abrir;
- não existe um utilizador na lista;
- não há centro de custo cadastrado;
- ainda não existe histórico de sincronização;
- não há resultado para aquele filtro.

A tour continua correta e honesta com o estado real do sistema.

### 6.2 Espera por DOM e carregamento

Passos dependentes de dados assíncronos podem aguardar o alvo por um tempo controlado.

Elementos estruturais podem esperar mais. Passos cujo fallback é `explain` ou `skip` devem esperar menos, evitando a sensação de travamento.

---

## 7. Alvos estáveis com `data-tour`

A tour não deve depender de:

- classes CSS;
- `nth-child`;
- texto visível;
- hierarquia interna do DOM;
- posição do elemento na página.

Em vez disso, usamos identificadores semânticos e estáveis.

```html
<input data-tour="company-users.search" />
<section data-tour="cost-centers.list"></section>
<button
  data-tour="company-access.grant"
  data-tour-business-action="true"
></button>
```

### 7.1 Características de um bom alvo

- nome semântico;
- ligado ao conceito e não à posição visual;
- estável após refactors de layout;
- pequeno o suficiente para um spotlight claro;
- aplicado apenas onde a tour realmente precisa;
- opcionalmente configurável em componentes reutilizáveis através de `tourId` ou `tourPrefix`.

### 7.2 Alinhamento visual é parte da qualidade

Um alvo pode estar tecnicamente correto e ainda assim produzir uma dica visualmente ruim.

Problemas comuns:

- wrapper grande demais;
- scroll interno de modal;
- spotlight cobrindo vários controlos ao mesmo tempo;
- popover distante do campo que está a explicar.

A validação precisa observar também a qualidade visual do spotlight e do posicionamento do popover.

---

## 8. Contrato conceitual de um passo

A implementação pode variar por produto, mas um passo precisa declarar mais do que “elemento + texto”.

```ts
type TourStep = {
  id: string
  route?: string
  target?: string
  title: string
  description: string
  missingTarget?: 'skip' | 'explain' | 'pause'
  condition?: (context) => boolean
  beforeEnter?: () => void | Promise<void>
  waitForTargetMs?: number
  helpArticleId?: string
}
```

O `beforeEnter` é reservado a navegação e preparação visual segura.

O runner deve conhecer, no mínimo:

- rota atual;
- utilizador autenticado;
- papéis e permissões;
- módulo e versão;
- progresso persistido;
- estado da UI;
- política de segurança das interações.

---

## 9. Persistência, retomada e versionamento

O progresso deve ser persistido no backend.

| Dado | Finalidade |
|---|---|
| `module_key` | Identidade estável do módulo. |
| `module_version` | Versão do conteúdo em andamento/concluído. |
| `status` | Em curso ou concluído. |
| `current_step` | Passo atual para retomada. |
| timestamps | Início, atualização e conclusão. |
| estado do convite | Guardado separadamente do progresso da tour. |

### 9.1 Estados apresentados ao utilizador

- **Não iniciado:** nunca iniciou aquela versão.
- **Em curso:** existe progresso parcial.
- **Concluído:** terminou a versão atual.
- **Atualizado:** concluiu uma versão anterior e existe uma nova versão do módulo.

### 9.2 Continuar, rever e ver atualização

Essas ações têm semânticas diferentes:

- **Continuar:** retoma do passo persistido.
- **Rever:** inicia novamente no primeiro passo sem apagar a conclusão anterior.
- **Ver atualização:** apresenta a versão mais recente de um módulo já concluído anteriormente.

### 9.3 Progresso acompanha a pessoa

Quando o produto é multiempresa ou multicontexto, a empresa corrente determina disponibilidade e permissões, mas não precisa ser a dona do progresso.

No modelo usado, o progresso acompanha o perfil da pessoa.

### 9.4 Coalescência de gravações

Em tours longas, gravar cada passo numa fila pode deixar o backend atrasado em relação à UI.

A estratégia usada foi:

1. se uma gravação já está em curso, manter apenas o estado mais recente pendente;
2. descartar estados intermediários já superados;
3. na conclusão, aguardar a persistência final antes de apresentar o módulo como concluído.

---

## 10. Convites sem spam

O convite inicial é separado do progresso do tutorial.

Boas regras:

- só mostrar depois de autenticação, contexto e papéis estarem resolvidos;
- não mostrar se não houver módulos prontos e disponíveis;
- “Agora não” encerra aquele convite;
- evitar cascata de popups na mesma sessão;
- não criar um convite para cada módulo de um papel já reconhecido;
- um papel realmente novo ou uma atualização relevante pode gerar nova oportunidade;
- em caso de erro na leitura de progresso/prompt, preferir não mostrar convite a mostrar algo incorreto.

---

## 11. Integração com documentação: “Saber mais”

A tour ensina no contexto. A documentação aprofunda.

O popover deve responder:

> “O que é isto e por que importa agora?”

O artigo deve responder:

> “Quais são todas as regras, exceções, cenários e detalhes?”

### 11.1 Fonte única de links

Os links de ajuda devem ser resolvidos a partir do índice oficial da documentação, utilizando a URL publicada como fonte de verdade.

Isso evita links quebrados e desacopla a tour da estrutura física dos ficheiros/artigos.

### 11.2 Quando usar vários “Saber mais”

Módulos com regras densas podem ter vários pontos de aprofundamento.

Exemplos:

- aprovações;
- categorias e regras financeiras;
- contabilização;
- aprovisionamento;
- integrações.

Isso é preferível a transformar o popover numa página de documentação.

---

## 12. Como escrever os passos

Um bom passo não narra a interface. Ele ensina alguma coisa.

Um passo deve cumprir pelo menos uma destas funções:

- **orientação:** onde estou?
- **significado:** o que este dado representa?
- **regra:** quando isto é usado?
- **consequência:** o que acontece se esta ação for executada?
- **ligação:** como isto se relaciona com outro processo?

### 12.1 Exemplos

| Evitar | Preferir |
|---|---|
| “Aqui está a pesquisa.” | “Use a pesquisa para localizar registos sem percorrer todas as páginas.” |
| “Clique em Guardar.” | “Ao guardar, estas alterações passam a valer para esta empresa. A tour não executa esta ação.” |
| “Este é o centro de custo.” | “A despesa precisa usar um centro de custo ativo da empresa corrente, inclusive quando o utilizador também pertence a outra empresa.” |
| Explicar todos os detalhes técnicos | Explicar a regra necessária e oferecer “Saber mais”. |

---

## 13. Estrutura recomendada de um módulo

Uma sequência típica pode seguir esta cadência:

1. **Contexto:** apresentar a área e o objetivo do módulo.
2. **Navegação:** identificar separadores, listas ou filtros principais.
3. **Consulta:** mostrar como localizar registos e interpretar estados.
4. **Exemplo real:** abrir um registo existente em modo de leitura, se houver.
5. **Regras de negócio:** explicar campos, dependências e consequências sem alterar nada.
6. **Ações sensíveis:** explicar o que fariam, sem executá-las.
7. **Histórico/auditoria:** mostrar onde validar o que aconteceu depois.
8. **Fecho:** reforçar a regra principal e permitir continuar na página ou regressar aos tutoriais.

---

## 14. Anti-padrões

| Anti-padrão | Problema |
|---|---|
| Tour que cria dados de demonstração | Polui o ambiente real e pode afetar relatórios ou integrações. |
| Tour que obriga a executar ação sensível | Mistura formação com operação e aumenta risco. |
| Seletores baseados em CSS/layout | Quebram facilmente após ajustes visuais. |
| Mega tour por papel | Duplica conteúdo, fica difícil de manter e reduz conclusão. |
| Popover usado como documentação completa | Fica pesado e ruim para leitura contextual. |
| Falhar quando não existem dados | Transforma um estado normal em erro da tour. |
| Resetar progresso ao rever | Apaga histórico e mistura revisão com primeira conclusão. |
| Guardar cada passo numa fila sem coalescer | Pode deixar o backend atrasado em relação à UI. |
| Forçar retorno à rota quando o utilizador sai | Interfere no trabalho real e cria sensação de aprisionamento. |

---

## 15. Checklist antes de publicar um módulo

### Conteúdo e UX

- [ ] O módulo tem objetivo claro e tamanho razoável?
- [ ] Cada passo ensina algo além de narrar a interface?
- [ ] A terminologia corresponde ao produto real?
- [ ] O spotlight está bem alinhado?
- [ ] Regras densas usam “Saber mais”?

### Segurança

- [ ] Nenhum `beforeEnter` executa ação de negócio?
- [ ] Botões sensíveis estão marcados como protegidos?
- [ ] A tour não cria dados de exemplo?
- [ ] Registos existentes são abertos apenas para consulta?
- [ ] Trocas automáticas de aba são realmente sem efeito de negócio?

### Robustez

- [ ] Lista vazia foi testada?
- [ ] Permissão parcial foi testada?
- [ ] Carregamento lento foi considerado?
- [ ] Cada alvo ausente tem `skip`, `explain` ou `pause` adequado?
- [ ] Voltar/avançar mantém modais e rotas coerentes?
- [ ] A conclusão atualiza o estado persistido antes de regressar à página de tutoriais?

### Manutenção

- [ ] Os `data-tour` são semânticos e estáveis?
- [ ] O módulo tem versão explícita?
- [ ] Os links de documentação existem no índice publicado?
- [ ] O catálogo define corretamente papéis e condições?
- [ ] A alteração foi testada sem mudar o comportamento de outros módulos?

---

## 16. Como aplicar em outro sistema

A abordagem não depende de React, Driver.js ou de uma stack específica.

O essencial é manter as responsabilidades separadas.

### Passos de implementação

1. Mapear papéis e objetivos de trabalho.
2. Dividir o produto em módulos ensináveis e reutilizáveis.
3. Escolher uma engine de spotlight/popover.
4. Criar um runner próprio sobre essa engine.
5. Criar um catálogo central de módulos, versões, rotas, papéis e estado de prontidão.
6. Adicionar alvos semânticos à UI.
7. Criar uma marca explícita para ações de negócio protegidas.
8. Implementar `skip`, `explain`, `pause` e espera de rota/DOM.
9. Persistir progresso por utilizador, módulo e versão.
10. Persistir convites separadamente.
11. Integrar com a base de conhecimento.
12. Publicar um módulo-piloto.
13. Validar segurança, retomada e qualidade visual.
14. Expandir por domínio mantendo o mesmo contrato.

### 16.1 O que muda de produto para produto

| Específico do produto | Reutilizável entre sistemas |
|---|---|
| Papéis, permissões e regras | Catálogo modular e composição de percursos |
| Rotas e componentes | Contrato de passos e `data-tour` semântico |
| Artigos de documentação | Padrão “Saber mais” |
| Estados e nomenclaturas | `skip` / `explain` / `pause` |
| Backend/tabelas concretas | Progresso por utilizador + módulo + versão |
| Ações sensíveis do domínio | Política “tour explica, não executa negócio” |

---

## 17. Métricas recomendadas

A qualidade não deve ser medida apenas por “quantos chegaram ao último passo”.

Indicadores úteis:

- taxa de início por módulo e por papel;
- taxa de conclusão;
- taxa de retomada;
- passos com maior abandono ou pausa;
- quantidade de fallbacks `explain` e `pause`;
- cliques em “Saber mais”;
- revisões voluntárias de módulos já concluídos;
- erros técnicos do runner;
- tempo médio de espera por alvo.

> Uma taxa de conclusão baixa não significa automaticamente uma tour ruim. Em sistemas operacionais, a pessoa pode aprender o que precisava e sair antes do fim. Métricas devem ser lidas junto com feedback qualitativo e contexto de uso.

---

## 18. Governança

Tours são conteúdo funcional dentro do produto.

Uma explicação desatualizada pode induzir comportamento incorreto mesmo quando o software está tecnicamente correto.

Por isso:

- mudanças relevantes de regra devem verificar módulos afetados;
- mudanças estruturais de UI devem preservar ou atualizar `data-tour`;
- mudanças relevantes de conteúdo devem avaliar incremento de versão;
- regras financeiras, permissões e integrações devem ser revistas por quem domina o assunto;
- tours não substituem autorização backend, validações, logs ou controlos de auditoria.

**Nota:** estas são diretrizes de arquitetura, UX e segurança operacional; não constituem aconselhamento jurídico ou regulatório.

---

## 19. Template para especificar um novo módulo

| Campo | Pergunta a responder |
|---|---|
| **Nome / chave** | Qual é o conceito ensinável e qual será a identidade estável? |
| **Versão** | É a primeira versão ou uma atualização relevante? |
| **Papéis** | Quem pode ver? Existe condição adicional? |
| **Rota inicial** | Qual é o ponto de entrada mais seguro? |
| **Objetivo** | O que a pessoa precisa entender ao terminar? |
| **Passos estruturais** | Quais alvos precisam existir? |
| **Dados opcionais** | Quais exemplos podem estar ausentes e usar `explain`? |
| **Ações protegidas** | Quais botões/fluxos nunca podem ser acionados pela tour? |
| **Documentação** | Quais artigos aprofundam as regras? |
| **Conclusão** | Onde a tour deve deixar a pessoa e qual mensagem final reforçar? |

---

## 20. Definition of Done de uma tour

- [ ] Conteúdo revisto por domínio e terminologia.
- [ ] Alvos estáveis adicionados e visualmente validados.
- [ ] Ações de negócio protegidas.
- [ ] Estados vazios e permissões parciais testados.
- [ ] Back/Next, pausa, retomada, revisão e conclusão testados.
- [ ] Persistência confirmada após conclusão.
- [ ] Links “Saber mais” válidos.
- [ ] Versão e catálogo atualizados.
- [ ] Nenhuma criação/edição de dados durante a tour.
- [ ] Módulo acessível por percurso e/ou tema conforme o desenho do produto.

---

## 21. Pontos para apresentação

Se for necessário resumir a abordagem numa reunião, os sete pontos principais são:

1. **Módulos independentes e versionáveis**, compostos em percursos por papel.
2. **Engine visual simples**, com a inteligência do produto num runner próprio.
3. **Alvos `data-tour` estáveis**, em vez de seletores frágeis.
4. **Política rígida de segurança:** a tour não executa ações de negócio sensíveis.
5. **Fallbacks `skip`, `explain` e `pause`** para lidar com estados reais e imprevisíveis.
6. **Progresso persistido e convites separados**, com continuar, rever e conteúdo atualizado.
7. **Integração com documentação**, para aprofundar regras sem sobrecarregar os popovers.

### Mensagem de encerramento

A principal mudança de mentalidade é parar de tratar tours como uma sequência de tooltips e passar a tratá-las como uma pequena plataforma de aprendizagem dentro do produto.

Quando o sistema tem papéis, permissões, dados reais e operações sensíveis, essa camada também precisa de arquitetura, segurança, versionamento e governança próprias.
