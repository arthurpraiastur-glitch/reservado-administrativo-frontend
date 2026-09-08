import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Cloud,
  Crown,
  FileCheck2,
  FileText,
  IdCard,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
  Trash2,
  UserRound,
  UserCog,
  UsersRound,
  XCircle,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router";

import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { annualitiesService } from "../../services/annualitiesService";
import { getApiErrorMessage } from "../../services/apiError";
import { contractsService } from "../../services/contractsService";

const PARTICIPANT_TYPE_LABELS = {
  TITULAR: "Titular",
  COTITULAR: "Co-titular",
  DEPENDENTE: "Dependente",
};

function formatDate(value, includeTime = false) {
  if (!value) return "Não informado";

  const normalizedValue =
    String(value).length === 10 ? `${value}T00:00:00` : value;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) return "Não informado";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

export function ContractDetailsPage() {
  const { contractId } = useParams();
  const { hasPermission } = useAuth();
  const [contract, setContract] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [participantToPromote, setParticipantToPromote] = useState(null);
  const [isSwappingHolder, setIsSwappingHolder] = useState(false);
  const [swapError, setSwapError] = useState("");
  const [roleChange, setRoleChange] = useState(null);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [roleChangeError, setRoleChangeError] = useState("");
  const [operationMessage, setOperationMessage] = useState("");
  const [showGenerateAnnuality, setShowGenerateAnnuality] = useState(false);
  const [isGeneratingAnnuality, setIsGeneratingAnnuality] = useState(false);
  const [generateAnnualityError, setGenerateAnnualityError] = useState("");
  const [annualityToDelete, setAnnualityToDelete] = useState(null);
  const [isDeletingAnnuality, setIsDeletingAnnuality] = useState(false);
  const [deleteAnnualityError, setDeleteAnnualityError] = useState("");
  const [isSyncingOmie, setIsSyncingOmie] = useState(false);
  const [syncOmieError, setSyncOmieError] = useState("");

  const canSwapHolder = hasPermission("CONTRATOS_EDITAR");
  const canSyncOmie = hasPermission("CONTRATOS_EDITAR");
  const canGenerateAnnuality = hasPermission("ANUIDADES_VISUALIZAR");
  const canDeleteAnnuality = hasPermission("ANUIDADES_EXCLUIR");

  useEffect(() => {
    let active = true;

    async function loadContract() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await contractsService.getById(contractId);

        if (active) {
          setContract(response);

          if (!response) {
            setLoadError("O contrato solicitado não foi encontrado.");
          }
        }
      } catch (error) {
        if (active) {
          setLoadError(
            getApiErrorMessage(
              error,
              "Não foi possível carregar os dados do contrato.",
            ),
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadContract();

    return () => {
      active = false;
    };
  }, [contractId, reloadToken]);

  function openPromoteHolder(participant) {
    setSwapError("");
    setParticipantToPromote(participant);
  }

  function closePromoteHolder() {
    if (isSwappingHolder) return;

    setParticipantToPromote(null);
    setSwapError("");
  }

  async function handleSwapHolder() {
    if (!participantToPromote?.associadoId || !contract?.id) return;

    setIsSwappingHolder(true);
    setSwapError("");
    setOperationMessage("");

    try {
      await contractsService.swapHolder(
        contract.id,
        participantToPromote.associadoId,
      );

      const nome = participantToPromote.nome || "Participante";
      setOperationMessage(
        `${nome} agora é o titular do contrato. A tag de participante também foi atualizada na Omie.`,
      );
      setParticipantToPromote(null);
      setReloadToken((current) => current + 1);
    } catch (error) {
      setSwapError(
        getApiErrorMessage(
          error,
          "Não foi possível trocar o titular. Nenhuma alteração foi confirmada.",
        ),
      );
    } finally {
      setIsSwappingHolder(false);
    }
  }

  function openRoleChange(participant, newTypeCode) {
    setRoleChangeError("");
    setRoleChange({ participant, newTypeCode });
  }

  function closeRoleChange() {
    if (isChangingRole) return;

    setRoleChange(null);
    setRoleChangeError("");
  }

  async function handleRoleChange() {
    if (
      !roleChange?.participant?.associadoId ||
      !roleChange?.newTypeCode ||
      !contract?.id
    ) {
      return;
    }

    setIsChangingRole(true);
    setRoleChangeError("");
    setOperationMessage("");

    try {
      await contractsService.changeParticipantType(
        contract.id,
        roleChange.participant.associadoId,
        roleChange.newTypeCode,
      );

      const participantName =
        roleChange.participant.nome || "Participante";
      const newTypeLabel =
        PARTICIPANT_TYPE_LABELS[roleChange.newTypeCode] ||
        roleChange.newTypeCode;

      setOperationMessage(
        `${participantName} agora está definido como ${newTypeLabel}. ` +
          "A tag da Omie e o vínculo no Reservado foram atualizados.",
      );
      setRoleChange(null);
      setReloadToken((current) => current + 1);
    } catch (error) {
      setRoleChangeError(
        getApiErrorMessage(
          error,
          "Não foi possível alterar a função do participante.",
        ),
      );
    } finally {
      setIsChangingRole(false);
    }
  }

  function openGenerateAnnuality() {
    const holderCount =
      contract?.participantes.filter((participant) => participant.ehTitular)
        .length ?? 0;

    if (holderCount !== 1) return;

    setGenerateAnnualityError("");
    setShowGenerateAnnuality(true);
  }

  function closeGenerateAnnuality() {
    if (isGeneratingAnnuality) return;

    setShowGenerateAnnuality(false);
    setGenerateAnnualityError("");
  }

  async function handleGenerateAnnuality() {
    if (!contract?.id) return;

    setIsGeneratingAnnuality(true);
    setGenerateAnnualityError("");
    setOperationMessage("");

    try {
      const result = await annualitiesService.gerarPorContrato(contract.id);

      setOperationMessage(
        `Anuidade ${result.anoReferencia ?? ""} gerada com vencimento em ` +
          `${formatDate(result.dataVencimento)}.`,
      );
      setShowGenerateAnnuality(false);
      setReloadToken((current) => current + 1);
    } catch (error) {
      setGenerateAnnualityError(
        getApiErrorMessage(
          error,
          "Não foi possível gerar a anuidade para este contrato.",
        ),
      );
    } finally {
      setIsGeneratingAnnuality(false);
    }
  }

  function openDeleteAnnuality(annuality) {
    if (annuality.possuiContaReceber) return;

    setDeleteAnnualityError("");
    setAnnualityToDelete(annuality);
  }

  function closeDeleteAnnuality() {
    if (isDeletingAnnuality) return;

    setAnnualityToDelete(null);
    setDeleteAnnualityError("");
  }

  async function handleDeleteAnnuality() {
    if (!annualityToDelete?.id) return;

    setIsDeletingAnnuality(true);
    setDeleteAnnualityError("");
    setOperationMessage("");

    try {
      await annualitiesService.excluir(annualityToDelete.id);

      setOperationMessage(
        `Anuidade #${annualityToDelete.id} (${annualityToDelete.anoReferencia}) excluída com sucesso.`,
      );
      setAnnualityToDelete(null);
      setReloadToken((current) => current + 1);
    } catch (error) {
      setDeleteAnnualityError(
        getApiErrorMessage(
          error,
          "Não foi possível excluir esta anuidade.",
        ),
      );
    } finally {
      setIsDeletingAnnuality(false);
    }
  }

  async function handleSyncOmie() {
    if (!contract?.id) return;

    setIsSyncingOmie(true);
    setSyncOmieError("");
    setOperationMessage("");

    try {
      const result = await contractsService.sincronizarOmie(contract.id);

      setOperationMessage(
        `Dados atualizados com a Omie: ${result.totalSincronizados} de ` +
          `${result.totalUsuarios} participante(s) sincronizado(s). Situação, ` +
          "características e demais dados foram trazidos de novo da Omie.",
      );
      setReloadToken((current) => current + 1);
    } catch (error) {
      setSyncOmieError(
        getApiErrorMessage(
          error,
          "Não foi possível buscar os dados deste contrato na Omie agora.",
        ),
      );
    } finally {
      setIsSyncingOmie(false);
    }
  }

  if (isLoading) return <DetailsSkeleton />;

  if (loadError || !contract) {
    return (
      <div className="space-y-5">
        <BackLink />
        <section className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-[0_12px_40px_rgba(56,32,65,0.06)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle size={28} />
          </div>
          <h2 className="mt-5 text-xl font-bold text-[#342b37]">
            Não foi possível abrir o contrato
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

  const completeNumber = [contract.numero, contract.letra]
    .filter(Boolean)
    .join(" / ");
  const totalAnnualities = contract.anuidades.length;
  const annualitiesWithReceivable = contract.anuidades.filter(
    (annuality) => annuality.possuiContaReceber,
  ).length;
  const holderCount = contract.participantes.filter(
    (participant) => participant.ehTitular,
  ).length;

  return (
    <div className="space-y-6">
      <BackLink />

      <section className="relative overflow-hidden rounded-3xl bg-[#432059] p-6 text-white shadow-[0_18px_50px_rgba(67,32,89,0.18)] sm:p-8">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full border-[45px] border-white/[0.04]" />
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
              <FileText size={27} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-white/75">
                  Contrato #{contract.id}
                </span>
                <StatusBadge active={contract.ativo} />
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
                {completeNumber || "Contrato sem número"}
              </h2>
              <p className="mt-2 text-sm text-white/65">
                {contract.situacao || "Situação não informada"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canSyncOmie && (
              <button
                type="button"
                onClick={handleSyncOmie}
                disabled={isSyncingOmie}
                title="Busca de novo na Omie a situação, características e demais dados deste contrato."
                className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSyncingOmie ? (
                  <>
                    <LoaderCircle size={17} className="animate-spin" />
                    Buscando na Omie...
                  </>
                ) : (
                  <>
                    <Cloud size={17} />
                    Atualizar dados da Omie
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setReloadToken((current) => current + 1)}
              className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
            >
              <RefreshCw size={17} />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {syncOmieError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700"
        >
          <XCircle size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Não foi possível atualizar com a Omie</p>
            <p className="mt-1 text-sm leading-6">{syncOmieError}</p>
          </div>
          <button
            type="button"
            onClick={() => setSyncOmieError("")}
            className="shrink-0 rounded-lg p-1 transition hover:bg-red-100"
            aria-label="Fechar mensagem"
          >
            <XCircle size={18} />
          </button>
        </div>
      )}

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
          icon={CalendarDays}
          label="Ano do contrato"
          value={contract.ano ?? "Não informado"}
        />
        <InformationCard
          icon={FileCheck2}
          label="Situação"
          value={contract.situacao || "Não informada"}
        />
        <InformationCard
          icon={CalendarCheck2}
          label="Anuidades vinculadas"
          value={totalAnnualities}
        />
        <InformationCard
          icon={ReceiptText}
          label="Com conta a receber"
          value={annualitiesWithReceivable}
        />
      </section>

      <ParticipantsSection
        participants={contract.participantes}
        canSwapHolder={canSwapHolder}
        onPromote={openPromoteHolder}
        onChangeType={openRoleChange}
      />

      <AnnualitiesSection
        annualities={contract.anuidades}
        canGenerate={canGenerateAnnuality}
        onGenerate={openGenerateAnnuality}
        holderCount={holderCount}
        canDelete={canDeleteAnnuality}
        onDelete={openDeleteAnnuality}
      />

      <section className="rounded-2xl border border-[#e7e1e9] bg-white p-5 shadow-[0_8px_30px_rgba(56,32,65,0.04)] sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Information
            label="Criado em"
            value={formatDate(contract.criadoEm, true)}
          />
          <Information
            label="Última atualização"
            value={formatDate(contract.atualizadoEm, true)}
          />
        </div>
        <p className="mt-4 text-xs leading-5 text-[#918794]">
          Os dados desta página são fornecidos pela API Financeiro.
        </p>
      </section>

      <Modal
        open={Boolean(participantToPromote)}
        onClose={closePromoteHolder}
        title="Trocar titular"
        description="O participante escolhido assume o posto de titular e o titular atual passa a ocupar o tipo de participante dele."
        maxWidth="max-w-xl"
      >
        {participantToPromote && (
          <>
            <div className="space-y-5 px-5 py-6 sm:px-6">
              <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <AlertTriangle size={22} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">Confira antes de continuar</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    Essa troca só é aplicada se a Omie confirmar a
                    sincronização da tag de participante dos dois clientes.
                    Se a Omie não confirmar, nada muda no Reservado.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Information
                  label="Novo titular"
                  value={participantToPromote.nome || "Não informado"}
                />
                <Information
                  label="Tipo atual"
                  value={
                    participantToPromote.tipoParticipanteNome ||
                    "Participante"
                  }
                />
                <Information
                  label="Titular atual"
                  value={
                    contract.participantes.find((p) => p.ehTitular)?.nome ||
                    "Não definido"
                  }
                />
                <Information
                  label="Contrato"
                  value={`#${contract.id}`}
                />
              </div>

              {swapError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
                >
                  <XCircle size={19} className="mt-0.5 shrink-0" />
                  <p className="text-sm leading-6">{swapError}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#eee9f0] bg-[#fcfafc] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={closePromoteHolder}
                disabled={isSwappingHolder}
                className="h-11 rounded-xl border border-[#dad3dd] px-5 text-sm font-bold text-[#675d6b] transition hover:border-[#bfaec6] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleSwapHolder}
                disabled={isSwappingHolder}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#432059] px-5 text-sm font-bold text-white transition hover:bg-[#341366] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSwappingHolder ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Trocando...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight size={17} />
                    Confirmar troca
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={Boolean(roleChange)}
        onClose={closeRoleChange}
        title="Alterar função do participante"
        description="A alteração é confirmada primeiro na Omie e depois gravada no Reservado."
        maxWidth="max-w-xl"
      >
        {roleChange && (
          <>
            <div className="space-y-5 px-5 py-6 sm:px-6">
              <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <AlertTriangle size={22} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">Alteração sincronizada</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    A tag de função será alterada nas características do
                    cliente na Omie. Se a Omie não confirmar, o Reservado não
                    será modificado.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Information
                  label="Participante"
                  value={roleChange.participant.nome || "Não informado"}
                />
                <Information
                  label="Função atual"
                  value={
                    roleChange.participant.tipoParticipanteNome ||
                    "Participante"
                  }
                />
                <Information
                  label="Nova função"
                  value={
                    PARTICIPANT_TYPE_LABELS[roleChange.newTypeCode] ||
                    roleChange.newTypeCode
                  }
                />
                <Information label="Contrato" value={`#${contract.id}`} />
              </div>

              {roleChangeError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
                >
                  <XCircle size={19} className="mt-0.5 shrink-0" />
                  <p className="text-sm leading-6">{roleChangeError}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#eee9f0] bg-[#fcfafc] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={closeRoleChange}
                disabled={isChangingRole}
                className="h-11 rounded-xl border border-[#dad3dd] px-5 text-sm font-bold text-[#675d6b] transition hover:border-[#bfaec6] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleRoleChange}
                disabled={isChangingRole}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#432059] px-5 text-sm font-bold text-white transition hover:bg-[#341366] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isChangingRole ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <UserCog size={17} />
                    Confirmar alteração
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={showGenerateAnnuality}
        onClose={closeGenerateAnnuality}
        title="Gerar anuidade"
        description="Gera uma nova anuidade para este contrato, com vencimento padrão calculado pela API."
        maxWidth="max-w-lg"
      >
        <div className="space-y-5 px-5 py-6 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Information label="Contrato" value={`#${contract.id}`} />
            <Information
              label="Anuidades já geradas"
              value={totalAnnualities}
            />
          </div>

          {generateAnnualityError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
            >
              <XCircle size={19} className="mt-0.5 shrink-0" />
              <p className="text-sm leading-6">{generateAnnualityError}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#eee9f0] bg-[#fcfafc] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={closeGenerateAnnuality}
            disabled={isGeneratingAnnuality}
            className="h-11 rounded-xl border border-[#dad3dd] px-5 text-sm font-bold text-[#675d6b] transition hover:border-[#bfaec6] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleGenerateAnnuality}
            disabled={isGeneratingAnnuality}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#432059] px-5 text-sm font-bold text-white transition hover:bg-[#341366] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingAnnuality ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <CalendarPlus size={17} />
                Gerar anuidade
              </>
            )}
          </button>
        </div>
      </Modal>

      <Modal
        open={annualityToDelete !== null}
        onClose={closeDeleteAnnuality}
        title="Excluir anuidade"
        description="Essa ação apaga a anuidade de vez do banco de dados — não é um cancelamento, não tem como desfazer."
        maxWidth="max-w-lg"
      >
        <div className="space-y-5 px-5 py-6 sm:px-6">
          <div className="flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
            <AlertTriangle size={22} className="mt-0.5 shrink-0" />
            <p className="text-sm leading-6 text-red-800">
              Confirma a exclusão física da{" "}
              <span className="font-bold">
                anuidade #{annualityToDelete?.id} (
                {annualityToDelete?.anoReferencia})
              </span>
              ? Use isso só quando ela foi gerada com valor/data errados e
              ainda não tem conta a receber nem boleto.
            </p>
          </div>

          {deleteAnnualityError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
            >
              <XCircle size={19} className="mt-0.5 shrink-0" />
              <p className="text-sm leading-6">{deleteAnnualityError}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#eee9f0] bg-[#fcfafc] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={closeDeleteAnnuality}
            disabled={isDeletingAnnuality}
            className="h-11 rounded-xl border border-[#dad3dd] px-5 text-sm font-bold text-[#675d6b] transition hover:border-[#bfaec6] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleDeleteAnnuality}
            disabled={isDeletingAnnuality}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeletingAnnuality ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 size={17} />
                Excluir de vez
              </>
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ParticipantsSection({
  participants = [],
  canSwapHolder = false,
  onPromote,
  onChangeType,
}) {
  const orderedParticipants = [...participants].sort(
    (first, second) => Number(second.ehTitular) - Number(first.ehTitular),
  );
  const holder = orderedParticipants.find(
    (participant) => participant.ehTitular,
  );
  const holderCount = orderedParticipants.filter(
    (participant) => participant.ehTitular,
  ).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e7e1e9] bg-white shadow-[0_8px_30px_rgba(56,32,65,0.04)]">
      <header className="flex flex-col gap-4 border-b border-[#eee9f0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0e8f3] text-[#5d276d]">
            <UsersRound size={19} />
          </div>
          <div>
            <h3 className="font-bold text-[#342b37]">
              Participantes do contrato
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#8a808e]">
              Titular, cotitulares, dependentes e beneficiários vinculados.
            </p>
          </div>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border border-[#e2d9e5] bg-[#faf8fb] px-3 py-1.5 text-xs font-bold text-[#6b5f70]">
          {participants.length}{" "}
          {participants.length === 1 ? "participante" : "participantes"}
        </span>
      </header>

      {participants.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3edf5] text-[#653475]">
            <UserRound size={25} />
          </div>
          <p className="mt-4 font-bold text-[#3d3340]">
            Nenhum participante vinculado
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#8a808e]">
            A API não retornou associados vinculados a este contrato.
          </p>
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          {!holder && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <div>
                <p className="text-sm font-bold">Titular não definido</p>
                <p className="mt-1 text-xs leading-5">
                  Existem participantes neste contrato, mas nenhum está marcado
                  como titular.
                </p>
              </div>
            </div>
          )}

          {holderCount > 1 && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <div>
                <p className="text-sm font-bold">
                  Mais de um titular encontrado
                </p>
                <p className="mt-1 text-xs leading-5">
                  Este contrato possui {holderCount} titulares ativos. A
                  geração de anuidade e boleto fica bloqueada até restar
                  exatamente um.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {orderedParticipants.map((participant) => (
              <ParticipantCard
                key={`${participant.associadoId}-${participant.clienteId}`}
                participant={participant}
                canSwapHolder={canSwapHolder}
                onPromote={onPromote}
                onChangeType={onChangeType}
                holderCount={holderCount}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ParticipantCard({
  participant,
  canSwapHolder = false,
  onPromote,
  onChangeType,
  holderCount = 0,
}) {
  const participantTypeCode = participant.tipoParticipanteCodigo
    ?.trim()
    .toUpperCase();
  const canSwapToHolder =
    !participant.ehTitular && holderCount === 1;
  const canDefineFirstHolder =
    !participant.ehTitular && holderCount === 0;
  const canDemoteExtraHolder =
    participant.ehTitular && holderCount > 1;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-5 transition ${
        participant.ehTitular
          ? "border-[#cdb6d6] bg-[#fbf8fc] shadow-[0_8px_24px_rgba(67,32,89,0.07)]"
          : "border-[#ebe5ed] bg-white"
      }`}
    >
      {participant.ehTitular && (
        <div className="absolute inset-y-0 left-0 w-1 bg-[#6f3a82]" />
      )}

      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            participant.ehTitular
              ? "bg-[#5d276d] text-white"
              : "bg-[#f1ecf3] text-[#6f3a82]"
          }`}
        >
          {participant.ehTitular ? (
            <Crown size={20} />
          ) : (
            <UserRound size={20} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="break-words font-bold text-[#342b37]">
              {participant.nome || "Nome não informado"}
            </h4>
            <ParticipantTypeBadge participant={participant} />
          </div>

          <div className="mt-3 space-y-2 text-sm text-[#786d7c]">
            <p className="flex items-center gap-2">
              <IdCard className="shrink-0 text-[#9a8f9e]" size={16} />
              <span>{participant.documento || "Documento não informado"}</span>
            </p>
            <p className="text-xs text-[#9a8f9e]">
              Associado #{participant.associadoId ?? "não informado"}
            </p>
          </div>

          {canSwapHolder && (
            <div className="mt-4 flex flex-wrap gap-2">
              {canSwapToHolder && (
                <ParticipantAction
                  onClick={() => onPromote?.(participant)}
                  icon={ArrowLeftRight}
                >
                  Tornar titular
                </ParticipantAction>
              )}

              {canDefineFirstHolder && (
                <ParticipantAction
                  onClick={() => onChangeType?.(participant, "TITULAR")}
                  icon={Crown}
                >
                  Definir como titular
                </ParticipantAction>
              )}

              {canDemoteExtraHolder && (
                <>
                  <ParticipantAction
                    onClick={() => onChangeType?.(participant, "COTITULAR")}
                    icon={UserCog}
                  >
                    Tornar co-titular
                  </ParticipantAction>
                  <ParticipantAction
                    onClick={() => onChangeType?.(participant, "DEPENDENTE")}
                    icon={UserCog}
                  >
                    Tornar dependente
                  </ParticipantAction>
                </>
              )}

              {!participant.ehTitular &&
                participantTypeCode === "COTITULAR" && (
                  <ParticipantAction
                    onClick={() => onChangeType?.(participant, "DEPENDENTE")}
                    icon={UserCog}
                  >
                    Tornar dependente
                  </ParticipantAction>
                )}

              {!participant.ehTitular &&
                participantTypeCode === "DEPENDENTE" && (
                  <ParticipantAction
                    onClick={() => onChangeType?.(participant, "COTITULAR")}
                    icon={UserCog}
                  >
                    Tornar co-titular
                  </ParticipantAction>
                )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ParticipantAction({ onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d4c0dc] bg-white px-3 text-xs font-bold text-[#5d276d] transition hover:bg-[#f6effa]"
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

function ParticipantTypeBadge({ participant }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        participant.ehTitular
          ? "border-[#d4c0dc] bg-[#f0e6f3] text-[#5d276d]"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {participant.ehTitular && <Crown size={12} />}
      {participant.tipoParticipanteNome || "Participante"}
    </span>
  );
}

function BackLink() {
  // A listagem manda os filtros aplicados no state — devolvemos a pessoa
  // pra mesma busca em vez de uma lista zerada.
  const location = useLocation();
  const listSearch = location.state?.listSearch ?? "";

  return (
    <Link
      to={`/contratos${listSearch}`}
      className="inline-flex items-center gap-2 text-sm font-bold text-[#5d276d] transition hover:text-[#341366]"
    >
      <ArrowLeft size={18} />
      Voltar para contratos
    </Link>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
        active
          ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
          : "border-white/15 bg-white/10 text-white/70"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-300" : "bg-white/50"
        }`}
      />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function InformationCard({ icon: Icon, label, value }) {
  return (
    <article className="rounded-2xl border border-[#e7e1e9] bg-white p-5 shadow-[0_8px_30px_rgba(56,32,65,0.04)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0e8f3] text-[#5d276d]">
        <Icon size={19} />
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.13em] text-[#958a99]">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold leading-6 text-[#3a303d]">
        {value}
      </p>
    </article>
  );
}

function AnnualitiesSection({
  annualities,
  canGenerate = false,
  onGenerate,
  holderCount = 0,
  canDelete = false,
  onDelete,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e7e1e9] bg-white shadow-[0_8px_30px_rgba(56,32,65,0.04)]">
      <header className="flex flex-col gap-4 border-b border-[#eee9f0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0e8f3] text-[#5d276d]">
            <Banknote size={19} />
          </div>
          <div>
            <h3 className="font-bold text-[#342b37]">Anuidades</h3>
            <p className="mt-1 text-xs leading-5 text-[#8a808e]">
              Valores e vencimentos vinculados a este contrato.
            </p>
          </div>
        </div>

        {canGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={holderCount !== 1}
            title={
              holderCount === 1
                ? undefined
                : "O contrato precisa ter exatamente um titular ativo."
            }
            className="inline-flex h-10 w-fit shrink-0 items-center gap-2 rounded-xl border border-[#d4c0dc] bg-white px-4 text-xs font-bold text-[#5d276d] transition hover:border-[#432059] hover:bg-[#f8f4fa] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarPlus size={16} />
            {holderCount === 1 ? "Gerar anuidade" : "Corrija o titular"}
          </button>
        )}
      </header>

      {annualities.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3edf5] text-[#653475]">
            <CalendarDays size={25} />
          </div>
          <p className="mt-4 font-bold text-[#3d3340]">
            Nenhuma anuidade vinculada
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#8a808e]">
            O backend ainda não retornou anuidades para este contrato.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse">
              <thead className="bg-[#faf8fb]">
                <tr>
                  <TableHeading>Ano</TableHeading>
                  <TableHeading>Valor</TableHeading>
                  <TableHeading>Vencimento</TableHeading>
                  <TableHeading>Pagamento</TableHeading>
                  <TableHeading>Situação</TableHeading>
                  <TableHeading>Conta a receber</TableHeading>
                  <TableHeading>Gerada em</TableHeading>
                  {canDelete && <TableHeading align="right">Ações</TableHeading>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ecf2]">
                {annualities.map((annuality) => (
                  <tr key={annuality.id} className="hover:bg-[#fcfafc]">
                    <TableCell strong>{annuality.anoReferencia}</TableCell>
                    <TableCell strong>
                      {formatCurrency(annuality.valor)}
                    </TableCell>
                    <TableCell>
                      {formatDate(annuality.dataVencimento)}
                    </TableCell>
                    <TableCell>
                      {formatDate(annuality.dataPagamento)}
                    </TableCell>
                    <TableCell>
                      {annuality.situacao || "Não informada"}
                    </TableCell>
                    <TableCell>
                      <ReceivableBadge
                        available={annuality.possuiContaReceber}
                      />
                    </TableCell>
                    <TableCell>
                      {formatDate(annuality.criadoEm, true)}
                    </TableCell>
                    {canDelete && (
                      <TableCell align="right">
                        {!annuality.possuiContaReceber && (
                          <button
                            type="button"
                            onClick={() => onDelete(annuality)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100"
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        )}
                      </TableCell>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-[#f0ecf2] md:hidden">
            {annualities.map((annuality) => (
              <article key={annuality.id} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#928895]">
                      Anuidade {annuality.anoReferencia}
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#342b37]">
                      {formatCurrency(annuality.valor)}
                    </p>
                  </div>
                  <ReceivableBadge
                    available={annuality.possuiContaReceber}
                  />
                </div>
                {canDelete && !annuality.possuiContaReceber && (
                  <button
                    type="button"
                    onClick={() => onDelete(annuality)}
                    className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100"
                  >
                    <Trash2 size={14} />
                    Excluir anuidade
                  </button>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Information
                    label="Vencimento"
                    value={formatDate(annuality.dataVencimento)}
                  />
                  <Information
                    label="Pagamento"
                    value={formatDate(annuality.dataPagamento)}
                  />
                  <Information
                    label="Situação"
                    value={annuality.situacao || "Não informada"}
                  />
                  <Information
                    label="Gerada em"
                    value={formatDate(annuality.criadoEm, true)}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ReceivableBadge({ available }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold ${
        available
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {available ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {available ? "Disponível" : "Não vinculada"}
    </span>
  );
}

function TableHeading({ children, align = "left" }) {
  return (
    <th
      className={`whitespace-nowrap px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8d8391] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TableCell({ children, strong = false, align = "left" }) {
  return (
    <td
      className={`whitespace-nowrap px-5 py-4 text-sm ${
        strong ? "font-bold text-[#413646]" : "text-[#756a79]"
      } ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </td>
  );
}

function Information({ label, value }) {
  return (
    <div className="rounded-xl bg-[#faf8fb] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#988e9c]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#554b59]">{value}</p>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando contrato">
      <div className="h-5 w-44 animate-pulse rounded bg-[#e9e2eb]" />
      <div className="h-52 animate-pulse rounded-3xl bg-[#e9e2eb]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-36 animate-pulse rounded-2xl bg-[#e9e2eb]"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-[#e9e2eb]" />
    </div>
  );
}
