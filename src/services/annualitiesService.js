import { api } from "./api";

function normalizeAnnuality(annuality = {}) {
  return {
    id: annuality.id,
    contratoId: annuality.contratoId,
    numeroContrato: annuality.numeroContrato ?? "",
    letraContrato: annuality.letraContrato ?? null,
    anoReferencia: annuality.anoReferencia ?? null,
    valor: Number(annuality.valor ?? 0),
    dataVencimento: annuality.dataVencimento ?? null,
    situacao: annuality.situacao ?? "",
    possuiContaReceber: annuality.possuiContaReceber === true,
    boletoGerado: annuality.boletoGerado === true,
    mensagemEnviada: annuality.mensagemEnviada === true,
    ultimoEnvioMensagemEm: annuality.ultimoEnvioMensagemEm ?? null,
    criadoEm: annuality.criadoEm ?? null,
  };
}

function normalizeContract(contract = {}) {
  return {
    id: contract.id,
    numero: contract.numero ?? "",
    letra: contract.letra ?? null,
    ano: contract.ano ?? null,
    situacao: contract.situacao ?? "",
    ativo: contract.ativo === true,
  };
}

function normalizeReceivable(receivable = {}) {
  return {
    id: receivable.id,
    pagadorClienteId: receivable.pagadorClienteId,
    numeroDocumento: receivable.numeroDocumento ?? null,
    numeroParcela: receivable.numeroParcela ?? null,
    valorOriginal: Number(receivable.valorOriginal ?? 0),
    valorAberto: Number(receivable.valorAberto ?? 0),
    dataEmissao: receivable.dataEmissao ?? null,
    dataVencimento: receivable.dataVencimento ?? null,
    situacao: receivable.situacao ?? "",
    boletoGerado: receivable.boletoGerado === true,
    mensagemEnviada: receivable.mensagemEnviada === true,
    ultimoEnvioMensagemEm: receivable.ultimoEnvioMensagemEm ?? null,
    pago: receivable.pago === true,
  };
}

function normalizeAnnualityDetails(annuality = {}) {
  return {
    id: annuality.id,
    contratoId: annuality.contratoId,
    anoReferencia: annuality.anoReferencia ?? null,
    valor: Number(annuality.valor ?? 0),
    dataVencimento: annuality.dataVencimento ?? null,
    dataPagamento: annuality.dataPagamento ?? null,
    situacao: annuality.situacao ?? "",
    criadoEm: annuality.criadoEm ?? null,
    atualizadoEm: annuality.atualizadoEm ?? null,
    contrato: normalizeContract(annuality.contrato),
    contasReceber: (annuality.contasReceber ?? []).map(normalizeReceivable),
  };
}

export const annualitiesService = {
  async list({
    anoReferencia = "",
    contratoId = "",
    numeroContrato = "",
    situacao = "",
    contaReceber = "TODOS",
    whatsapp = "TODOS",
    boleto = "TODOS",
    numeroPagina = 1,
    tamanhoPagina = 20,
  } = {}) {
    const params = {
      numeroPagina,
      tamanhoPagina: Math.min(tamanhoPagina, 200),
    };

    if (anoReferencia !== "") {
      params.anoReferencia = Number(anoReferencia);
    }
    if (contratoId !== "") params.contratoId = Number(contratoId);
    if (numeroContrato.trim()) {
      params.numeroContrato = numeroContrato.trim();
    }
    if (situacao.trim()) params.situacao = situacao.trim();
    if (contaReceber === "COM_CONTA") params.possuiContaReceber = true;
    if (contaReceber === "SEM_CONTA") params.possuiContaReceber = false;
    if (whatsapp === "ENVIADA") params.mensagemEnviada = true;
    if (whatsapp === "NAO_ENVIADA") params.mensagemEnviada = false;
    if (boleto === "COM_BOLETO") params.boletoGerado = true;
    if (boleto === "SEM_BOLETO") params.boletoGerado = false;

    const response = await api.get("/anuidades", { params });
    const payload = response.data ?? {};
    const rawItems = Array.isArray(payload)
      ? payload
      : payload.itens ?? payload.items ?? [];

    return {
      items: rawItems.map(normalizeAnnuality),
      totalRegistros: payload.totalRegistros ?? rawItems.length,
      numeroPagina: payload.numeroPagina ?? numeroPagina,
      tamanhoPagina: payload.tamanhoPagina ?? tamanhoPagina,
      totalPaginas: payload.totalPaginas ?? 1,
      temPaginaAnterior:
        payload.temPaginaAnterior ?? numeroPagina > 1,
      temProximaPagina:
        payload.temProximaPagina ??
        numeroPagina < (payload.totalPaginas ?? 1),
    };
  },

  async getById(annualityId) {
    const response = await api.get(`/anuidades/${annualityId}`);
    const payload = response.data?.dados ?? response.data ?? {};

    return normalizeAnnualityDetails(payload);
  },

  async gerarPorContrato(contratoId, dataVencimento = "") {
    const params = {};
    if (dataVencimento) params.dataVencimento = dataVencimento;

    const response = await api.post(
      `/anuidades/contratos/${contratoId}/gerar`,
      null,
      { params },
    );
    const payload = response.data?.dados ?? response.data ?? {};

    return {
      anuidadeId: payload.anuidadeId,
      contratoId: payload.contratoId ?? Number(contratoId),
      anoReferencia: payload.anoReferencia ?? null,
      valor: Number(payload.valor ?? 0),
      dataVencimento: payload.dataVencimento ?? null,
      situacao: payload.situacao ?? "",
    };
  },

  async gerarEmMassa(dataVencimento = "", contratoIds = []) {
    const body = { contratoIds };
    if (dataVencimento) body.dataVencimento = dataVencimento;

    const response = await api.post("/anuidades/gerar-em-massa", body);
    const payload = response.data?.dados ?? response.data ?? {};

    return {
      totalContratos: payload.totalContratos ?? 0,
      geradas: payload.geradas ?? 0,
      erros: payload.erros ?? 0,
      contratosComErro: (payload.contratosComErro ?? []).map((item) => ({
        contratoId: item.contratoId,
        numero: item.numero ?? "",
        letra: item.letra ?? null,
        motivo: item.motivo ?? "",
      })),
      contratosJaExistentes: (payload.contratosJaExistentes ?? []).map(
        (item) => ({
          contratoId: item.contratoId,
          numero: item.numero ?? "",
          letra: item.letra ?? null,
          mensagem: item.mensagem ?? "",
        }),
      ),
      // Contratos que realmente geraram anuidade nova nesta chamada — usado
      // pra sugerir o modal de "gerar boletos em massa" com base só no que
      // essa pessoa acabou de gerar, sem misturar com o que outra pessoa
      // gerou ao mesmo tempo em outra máquina.
      contratosGerados: (payload.contratosGerados ?? []).map((item) => ({
        id: item.contratoId,
        numero: item.numero ?? "",
        letra: item.letra ?? null,
      })),
    };
  },

  async gerarBoleto(anuidadeId) {
    const response = await api.post(`/anuidades/${anuidadeId}/gerar-boleto`);
    const payload = response.data?.dados ?? response.data ?? {};

    return {
      anuidadeId: payload.anuidadeId ?? Number(anuidadeId),
      contaReceberId: payload.contaReceberId ?? null,
      codigoLancamentoOmie: payload.codigoLancamentoOmie ?? null,
      numeroBoleto: payload.numeroBoleto ?? null,
    };
  },

  async gerarBoletosEmMassa(contratoIds = []) {
    const response = await api.post("/anuidades/gerar-boletos-em-massa", {
      contratoIds,
    });
    const payload = response.data?.dados ?? response.data ?? {};

    return {
      total: payload.total ?? 0,
      gerados: payload.gerados ?? 0,
      erros: payload.erros ?? 0,
      contratosComErro: (payload.contratosComErro ?? []).map((item) => ({
        contratoId: item.contratoId,
        numero: item.numero ?? "",
        letra: item.letra ?? null,
        motivo: item.motivo ?? "",
      })),
      contratosJaExistentes: (payload.contratosJaExistentes ?? []).map(
        (item) => ({
          contratoId: item.contratoId,
          numero: item.numero ?? "",
          letra: item.letra ?? null,
          mensagem: item.mensagem ?? "",
        }),
      ),
    };
  },

  async enviarBoleto(contaReceberId) {
    const response = await api.post(
      `/anuidades/contas-receber/${contaReceberId}/enviar-boleto`,
    );
    const payload = response.data?.dados ?? response.data ?? {};

    return {
      contaReceberId: payload.contaReceberId ?? Number(contaReceberId),
      boletoId: payload.boletoId ?? null,
      bitrixItemId: payload.bitrixItemId ?? null,
    };
  },

  async enviarBoletosEmMassa(anuidadeIds = []) {
    // O backend chama esse campo de "contaReceberIds" no corpo da
    // requisição, mas internamente ele resolve por ID de ANUIDADE
    // (ObterPorAnuidadeIdAsync) — o nome do campo é só uma inconsistência
    // de nomenclatura do contrato existente, não altere sem confirmar.
    const response = await api.post("/anuidades/enviar-boletos-em-massa", {
      contaReceberIds: anuidadeIds,
    });
    const payload = response.data?.dados ?? response.data ?? {};

    return {
      totalEncontrados: payload.totalEncontrados ?? 0,
      totalEnviados: payload.totalEnviados ?? 0,
      totalIgnorados: payload.totalIgnorados ?? 0,
      totalErros: payload.totalErros ?? 0,
      ignorados: payload.ignorados ?? [],
      erros: payload.erros ?? [],
    };
  },

  async excluir(anuidadeId) {
    const response = await api.delete(`/anuidades/${anuidadeId}`);
    const payload = response.data?.dados ?? response.data ?? {};

    return {
      anuidadeId: payload.anuidadeId ?? Number(anuidadeId),
      contratoId: payload.contratoId ?? null,
      anoReferencia: payload.anoReferencia ?? null,
    };
  },
};
