import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Landmark,
  Link2,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router";

import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { getApiErrorMessage } from "../../services/apiError";
import { receivablesService } from "../../services/receivablesService";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function ReceivableDetailsPage() {
  const { receivableId } = useParams();
  const { hasPermission } = useAuth();
  const [receivable, setReceivable] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [boletoToCancel, setBoletoToCancel] = useState(null);
  const [isCancellingBoleto, setIsCancellingBoleto] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [operationMessage, setOperationMessage] = useState("");

  const canCancelBoletos = hasPermission("BOLETOS_EXCLUIR");

  useEffect(() => {
    let active = true;

    async function loadReceivable() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await receivablesService.getById(receivableId);

        if (active) {
          setReceivable(response?.id ? response : null);

          if (!response?.id) {
            setLoadError("A conta a receber solicitada não foi encontrada.");
          }
        }
      } catch (error) {
        if (active) {
          setLoadError(
            getApiErrorMessage(
              error,
              "Não foi possível carregar os dados da conta a receber.",
            ),
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadReceivable();

    return () => {
      active = false;
    };
  }, [receivableId, reloadToken]);

  const paymentTotals = useMemo(
    () =>
      (receivable?.pagamentos ?? []).reduce(
        (totals, payment) => ({
          principal: totals.principal + payment.valorPrincipal,
          interest: totals.interest + payment.valorJuros,
          fine: totals.fine + payment.valorMulta,
          discount: totals.discount + payment.valorDesconto,
          total: totals.total + payment.valorTotal,
        }),
        { principal: 0, interest: 0, fine: 0, discount: 0, total: 0 },
      ),
    [receivable],
  );

  function openBoletoCancellation(boleto) {
    setCancelError("");
    setBoletoToCancel(boleto);
  }

  function closeBoletoCancellation() {
    if (isCancellingBoleto) return;

    setBoletoToCancel(null);
    setCancelError("");
  }

  async function handleCancelBoleto() {
    if (!boletoToCancel?.id || !receivable?.id) return;

    setIsCancellingBoleto(true);
    setCancelError("");
    setOperationMessage("");

    try {
      const result = await receivablesService.cancelBoleto(
        receivable.id,
        boletoToCancel.id,
      );

      setOperationMessage(
        result.jaEstavaCancelado
          ? "Este boleto já estava cancelado. Os dados foram atualizados."
          : "Boleto cancelado com sucesso na Omie e no Reservado.",
      );
      setBoletoToCancel(null);
      setReloadToken((current) => current + 1);
    } catch (error) {
      setCancelError(
        getApiErrorMessage(
          error,
          "Não foi possível cancelar o boleto. Nenhuma alteração local foi confirmada.",
        ),
      );
    } finally {
      setIsCancellingBoleto(false);
    }
  }

  if (isLoading) return <DetailsSkeleton />;

  if (loadError || !receivable) {
    return (
      <div className="space-y-5">
        <BackLink />
        <section className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-[0_12px_40px_rgba(56,32,65,0.06)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle size={28} />
          </div>
          <h2 className="mt-5 text-xl font-bold text-[#342b37]">
            Não foi possível abrir a conta a receber
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#817688]">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => setReloadToken((current) => current + 1)}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#432059] px-5 text-sm font-bold text-white transition hover:bg-[#341366]"
          >
            <RefreshCw size={18} />
            Tentar novamente
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <Hero
        receivable={receivable}
        onRefresh={() => setReloadToken((current) => current + 1)}
      />

      {operationMessage && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800"
        >
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Operação concluída</p>
            <p className="mt-1 text-sm leading-6">{operationMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setOperationMessage("")}
            className="shrink-0 rounded-lg p-1 transition hover:bg-emerald-100"
            aria-label="Fechar mensagem"
          >
            <XCircle size={18} />
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InformationCard
          icon={CircleDollarSign}
          label="Valor original"
          value={formatCurrency(receivable.valorOriginal)}
        />
        <InformationCard
          icon={Banknote}
          label="Valor em aberto"
          value={formatCurrency(receivable.valorAberto)}
          accent="amber"
        />
        <InformationCard
          icon={CalendarDays}
          label="Vencimento"
          value={formatDate(receivable.dataVencimento)}
          accent="blue"
        />
        <InformationCard
          icon={WalletCards}
          label="Pagamentos"
          value={receivable.pagamentos.length}
          accent="green"
        />
      </section>

      <GeneralInformation receivable={receivable} />
      <Relations receivable={receivable} />
      <Payments payments={receivable.pagamentos} totals={paymentTotals} />
      <Boletos
        boletos={receivable.boletos}
        canCancel={canCancelBoletos}
        onCancel={openBoletoCancellation}
      />
      <Integrations integrations={receivable.integracoes} />

      <section className="rounded-2xl border border-[#e7e1e9] bg-white p-5 shadow-[0_8px_30px_rgba(56,32,65,0.04)] sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Information label="Registro criado em" value={formatDate(receivable.criadoEm, true)} />
          <Information label="Última atualização" value={formatDate(receivable.atualizadoEm, true)} />
        </div>
        <p className="mt-4 text-xs leading-5 text-[#918794]">
          Esta página é somente para consulta e utiliza os dados fornecidos
          pela API Financeiro.
        </p>
      </section>

      <Modal
        open={Boolean(boletoToCancel)}
        onClose={closeBoletoCancellation}
        title="Cancelar boleto"
        description="Confirme o cancelamento deste boleto integrado à Omie."
        maxWidth="max-w-xl"
      >
        {boletoToCancel && (
          <>
            <div className="space-y-5 px-5 py-6 sm:px-6">
              <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <AlertTriangle size={22} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">Confira antes de continuar</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    O sistema tentará cancelar primeiro na Omie. O boleto só
                    será marcado como cancelado no Reservado se a Omie
                    confirmar a operação.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Information
                  label="Conta a receber"
                  value={`#${receivable.id}`}
                />
                <Information
                  label="Boleto"
                  value={
                    boletoToCancel.numeroBoleto || `#${boletoToCancel.id}`
                  }
                />
                <Information
                  label="Documento"
                  value={receivable.numeroDocumento || "Não informado"}
                />
                <Information
                  label="Vencimento"
                  value={formatDate(boletoToCancel.dataVencimento)}
                />
              </div>

              {cancelError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
                >
                  <XCircle size={19} className="mt-0.5 shrink-0" />
                  <p className="text-sm leading-6">{cancelError}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#eee9f0] bg-[#fcfafc] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={closeBoletoCancellation}
                disabled={isCancellingBoleto}
                className="h-11 rounded-xl border border-[#dad3dd] px-5 text-sm font-bold text-[#675d6b] transition hover:border-[#bfaec6] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelBoleto}
                disabled={isCancellingBoleto}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancellingBoleto ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <Trash2 size={17} />
                    Confirmar cancelamento
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function BackLink() {
  // A listagem manda os filtros aplicados no state — devolvemos a pessoa
  // pra mesma busca em vez de uma lista zerada.
  const location = useLocation();
  const listSearch = location.state?.listSearch ?? "";

  return (
    <Link
      to={`/contas-receber${listSearch}`}
      className="inline-flex items-center gap-2 text-sm font-bold text-[#5d276d] transition hover:text-[#341366]"
    >
      <ArrowLeft size={18} />
      Voltar para contas a receber
    </Link>
  );
}

function Hero({ receivable, onRefresh }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#432059] p-6 text-white shadow-[0_18px_50px_rgba(67,32,89,0.18)] sm:p-8">
      <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full border-[45px] border-white/[0.04]" />
      <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
            <WalletCards size={27} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-white/75">
                Conta #{receivable.id}
              </span>
              <DarkBadge>{receivable.situacao || "Situação não informada"}</DarkBadge>
              <DarkBadge>{receivable.pago ? "Pago" : "Em aberto"}</DarkBadge>
            </div>
            <h2 className="mt-4 break-words text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              {receivable.numeroDocumento || "Documento não informado"}
            </h2>
            <p className="mt-2 text-sm text-white/65">
              Parcela {receivable.numeroParcela || "não informada"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
        >
          <RefreshCw size={17} />
          Atualizar
        </button>
      </div>
    </section>
  );
}

function GeneralInformation({ receivable }) {
  return (
    <Section
      icon={FileText}
      title="Informações da cobrança"
      description="Datas, códigos e referências financeiras registradas para esta conta."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Information label="Emissão" value={formatDate(receivable.dataEmissao)} />
        <Information label="Registro" value={formatDate(receivable.dataRegistro)} />
        <Information label="Previsão" value={formatDate(receivable.dataPrevisao)} />
        <Information label="Situação" value={receivable.situacao || "Não informada"} />
        <Information label="Categoria" value={receivable.codigoCategoria || "Não informada"} />
        <Information label="Tipo de documento" value={receivable.codigoTipoDocumento || "Não informado"} />
        <Information label="Projeto externo" value={receivable.codigoProjetoExterno || "Não informado"} />
        <Information label="Conta corrente externa" value={receivable.codigoContaCorrenteExterno || "Não informada"} />
      </div>
      {receivable.observacao && (
        <div className="mt-4 rounded-xl border border-[#ebe5ed] bg-[#fcfafc] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#988e9c]">Observação</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#625766]">{receivable.observacao}</p>
        </div>
      )}
    </Section>
  );
}

function Relations({ receivable }) {
  const contract = receivable.contrato;
  const contractNumber = contract
    ? [contract.numero, contract.letra].filter(Boolean).join(" / ")
    : "";

  return (
    <Section
      icon={Link2}
      title="Vínculos"
      description="Registros relacionados à origem e ao responsável pela cobrança."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {contract || receivable.contratoId ? (
          <RelationCard
            title="Contrato"
            value={contractNumber || `#${contract?.id ?? receivable.contratoId}`}
            detail={`${contract?.ano ?? "Ano não informado"} · ${contract?.situacao || "Situação não informada"}`}
            to={`/contratos/${contract?.id ?? receivable.contratoId}`}
          />
        ) : (
          <RelationCard
            title="Contrato"
            value="Sem contrato vinculado"
            detail="Esta cobrança não está associada a um contrato."
          />
        )}
        {receivable.anuidade ? (
          <RelationCard
            title="Anuidade"
            value={receivable.anuidade.anoReferencia ?? `#${receivable.anuidade.id}`}
            detail={`${formatCurrency(receivable.anuidade.valor)} · ${receivable.anuidade.situacao || "Situação não informada"}`}
            to={`/anuidades/${receivable.anuidade.id}`}
          />
        ) : (
          <RelationCard title="Anuidade" value="Sem anuidade vinculada" detail="Esta cobrança não está associada a uma anuidade." />
        )}
        {receivable.pagadorClienteId ? (
          <RelationCard
            title="Cliente pagador"
            value={`Cliente #${receivable.pagadorClienteId}`}
            detail="Responsável financeiro pela conta."
            to={`/clientes/${receivable.pagadorClienteId}`}
          />
        ) : (
          <RelationCard
            title="Cliente pagador"
            value="Sem pagador vinculado"
            detail="A conta não possui um cliente pagador associado."
          />
        )}
      </div>
    </Section>
  );
}

function Payments({ payments, totals }) {
  return (
    <Section
      icon={CheckCircle2}
      title="Pagamentos"
      description="Valores recebidos e acréscimos registrados para esta conta."
      action={payments.length > 0 ? `Total recebido: ${formatCurrency(totals.total)}` : null}
    >
      {payments.length === 0 ? (
        <EmptyCollection icon={Banknote} text="Nenhum pagamento registrado" />
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <article key={payment.id} className="rounded-2xl border border-[#e9e3eb] p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="font-bold text-[#3c323f]">{formatCurrency(payment.valorTotal)}</p>
                  <p className="mt-1 text-xs text-[#8b818f]">Pago em {formatDate(payment.dataPagamento)}</p>
                </div>
                <StatusBadge positive>Pagamento registrado</StatusBadge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Information label="Valor principal" value={formatCurrency(payment.valorPrincipal)} />
                <Information label="Juros" value={formatCurrency(payment.valorJuros)} />
                <Information label="Multa" value={formatCurrency(payment.valorMulta)} />
                <Information label="Desconto" value={formatCurrency(payment.valorDesconto)} />
                <Information label="Data do crédito" value={formatDate(payment.dataCredito)} />
                <Information label="Forma de pagamento" value={payment.formaPagamento || "Não informada"} />
                <Information label="Sistema" value={payment.sistema || "Não informado"} />
                <Information label="Código externo" value={payment.codigoExterno || "Não informado"} />
              </div>
              {payment.observacao && <p className="mt-4 text-sm leading-6 text-[#716675]">{payment.observacao}</p>}
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}

function Boletos({ boletos, canCancel, onCancel }) {
  return (
    <Section
      icon={Landmark}
      title="Boletos"
      description="Documentos bancários gerados para esta cobrança."
      action={boletos.length > 0 ? `${boletos.length} ${boletos.length === 1 ? "boleto" : "boletos"}` : null}
    >
      {boletos.length === 0 ? (
        <EmptyCollection icon={ReceiptText} text="Nenhum boleto registrado" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {boletos.map((boleto) => (
            <article key={boleto.id} className="rounded-2xl border border-[#e9e3eb] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[#3c323f]">{boleto.numeroBoleto || `Boleto #${boleto.id}`}</p>
                  <p className="mt-1 text-xs text-[#8b818f]">{boleto.numeroBancario || boleto.codigoExterno || "Identificação bancária não informada"}</p>
                </div>
                <StatusBadge positive={!boleto.dataCancelamento}>{boleto.dataCancelamento ? "Cancelado" : boleto.situacao || "Ativo"}</StatusBadge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Information label="Emissão" value={formatDate(boleto.dataEmissao)} />
                <Information label="Vencimento" value={formatDate(boleto.dataVencimento)} />
                <Information label="Juros" value={`${decimalFormatter.format(boleto.percentualJuros)}%`} />
                <Information label="Multa" value={`${decimalFormatter.format(boleto.percentualMulta)}%`} />
              </div>
              {boleto.linhaDigitavel && <CopyableValue label="Linha digitável" value={boleto.linhaDigitavel} />}
              {boleto.codigoBarras && <CopyableValue label="Código de barras" value={boleto.codigoBarras} />}
              <div className="mt-4 flex flex-wrap gap-2">
                {boleto.urlBoleto && (
                  <a href={boleto.urlBoleto} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dcd4df] px-4 text-xs font-bold text-[#5d276d] transition hover:border-[#432059] hover:bg-[#f8f4fa]">
                    <ExternalLink size={15} />
                    Abrir boleto
                  </a>
                )}
                {canCancel && !isBoletoCancelled(boleto) && (
                  <button
                    type="button"
                    onClick={() => onCancel(boleto)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100"
                  >
                    <Trash2 size={15} />
                    Cancelar boleto
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}

function isBoletoCancelled(boleto) {
  return (
    Boolean(boleto.dataCancelamento) ||
    boleto.situacao?.trim().toUpperCase() === "CANCELADO"
  );
}

function Integrations({ integrations }) {
  return (
    <Section
      icon={Link2}
      title="Integrações"
      description="Referências de sincronização com sistemas externos."
    >
      {integrations.length === 0 ? (
        <EmptyCollection icon={Link2} text="Nenhuma integração registrada" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {integrations.map((integration) => (
            <article key={integration.id} className="rounded-2xl border border-[#e9e3eb] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[#3c323f]">{integration.sistema || "Sistema não informado"}</p>
                  <p className="mt-1 text-xs text-[#8b818f]">{integration.codigoIntegracao || "Código de integração não informado"}</p>
                </div>
                <StatusBadge positive>{integration.statusExterno || "Sincronizado"}</StatusBadge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Information label="Código externo" value={integration.codigoExterno || "Não informado"} />
                <Information label="Sincronizado em" value={formatDate(integration.sincronizadoEm, true)} />
              </div>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}

function Section({ icon: Icon, title, description, action, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e7e1e9] bg-white shadow-[0_8px_30px_rgba(56,32,65,0.04)]">
      <header className="flex flex-col justify-between gap-4 border-b border-[#eee9f0] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0e8f3] text-[#5d276d]">
            <Icon size={19} />
          </div>
          <div>
            <h3 className="font-bold text-[#342b37]">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-[#8a808e]">{description}</p>
          </div>
        </div>
        {action && <span className="w-fit rounded-lg bg-[#f7f3f8] px-3 py-2 text-xs font-bold text-[#65486f]">{action}</span>}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function RelationCard({ title, value, detail, to }) {
  const content = (
    <>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#988e9c]">{title}</p>
      <p className="mt-2 font-bold text-[#413646]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#8a808e]">{detail}</p>
    </>
  );

  if (!to) return <article className="rounded-2xl bg-[#faf8fb] p-4">{content}</article>;

  return (
    <Link to={to} className="group rounded-2xl border border-transparent bg-[#faf8fb] p-4 transition hover:border-[#d7cbdc] hover:bg-[#f7f2f8]">
      {content}
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#653475]">
        Abrir detalhes <ExternalLink size={13} />
      </span>
    </Link>
  );
}

function InformationCard({ icon: Icon, label, value, accent = "purple" }) {
  const accents = {
    purple: "bg-[#f0e8f3] text-[#5d276d]",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
  };

  return (
    <article className="rounded-2xl border border-[#e7e1e9] bg-white p-5 shadow-[0_8px_30px_rgba(56,32,65,0.04)]">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accents[accent]}`}><Icon size={19} /></div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.13em] text-[#958a99]">{label}</p>
      <p className="mt-2 text-xl font-bold leading-6 text-[#3a303d]">{value}</p>
    </article>
  );
}

function Information({ label, value }) {
  return (
    <div className="rounded-xl bg-[#faf8fb] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#988e9c]">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-[#554b59]">{value}</p>
    </div>
  );
}

function EmptyCollection({ icon: Icon, text }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl bg-[#faf8fb] p-6 text-center">
      <Icon size={24} className="text-[#765381]" />
      <p className="mt-3 text-sm font-bold text-[#554b59]">{text}</p>
    </div>
  );
}

function CopyableValue({ label, value }) {
  return (
    <div className="mt-3 rounded-xl bg-[#faf8fb] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#988e9c]">{label}</p>
      <p className="mt-1 break-all font-mono text-xs leading-5 text-[#554b59]">{value}</p>
    </div>
  );
}

function DarkBadge({ children }) {
  return <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80">{children}</span>;
}

function StatusBadge({ positive = false, children }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${positive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
      {positive ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {children}
    </span>
  );
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value ?? 0));
}

function formatDate(value, includeTime = false) {
  if (!value) return "Não informado";

  const normalizedValue = String(value).length === 10 ? `${value}T00:00:00` : value;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) return "Não informado";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function DetailsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando conta a receber">
      <div className="h-5 w-52 animate-pulse rounded bg-[#e9e2eb]" />
      <div className="h-52 animate-pulse rounded-3xl bg-[#e9e2eb]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-[#e9e2eb]" />)}
      </div>
      {[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-[#e9e2eb]" />)}
    </div>
  );
}
