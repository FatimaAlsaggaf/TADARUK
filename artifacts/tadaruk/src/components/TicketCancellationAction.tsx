import { useState } from "react";
import type { MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import {
  getGetOverviewQueryKey,
  getGetTicketQueryKey,
  getListBranchesQueryKey,
  getListTicketsQueryKey,
  getListTechniciansQueryKey,
  usePerformTicketAction,
} from "@workspace/api-client-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Lang = "ar" | "en";
const tr = (lang: Lang, ar: string, en: string) => lang === "ar" ? ar : en;

export function TicketCancellationAction({
  ticketId,
  ticketNumber,
  lang,
  manager = false,
}: {
  ticketId: string;
  ticketNumber: string;
  lang: Lang;
  manager?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const action = usePerformTicketAction();
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
    void queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListTechniciansQueryKey() });
  };
  const confirm = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    action.mutate({ ticketId, data: { action: "cancel" } }, {
      onSuccess: () => {
        invalidate();
        setOpen(false);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) action.reset();
    }}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="ticket-cancel-trigger"
          aria-label={tr(lang, `حذف البلاغ ${ticketNumber}`, `Delete report ${ticketNumber}`)}
          data-testid={`button-cancel-ticket-${ticketId}`}
        >
          <Trash2 size={16} aria-hidden="true" />
          <span>{tr(lang, "حذف البلاغ", "Delete report")}</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="ticket-cancel-dialog" dir={lang === "ar" ? "rtl" : "ltr"}>
        <AlertDialogHeader>
          <AlertDialogTitle>{tr(lang, "حذف البلاغ؟", "Delete report?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {manager
              ? tr(lang, "سيُلغى البلاغ من السجلات النشطة مع الاحتفاظ بسجل الإجراء.", "This removes the report from active records while keeping its audit history.")
              : tr(lang, "سيُزال البلاغ من قائمتك. هل تريد المتابعة؟", "This will remove the report from your list. Do you want to continue?")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {action.isError && (
          <p className="ticket-cancel-error" role="alert" data-testid="status-cancel-ticket-error">
            {tr(lang, "تعذر حذف البلاغ. ربما تغيّرت حالته؛ حدّث الصفحة وحاول مجدداً.", "Could not delete the report. Its state may have changed; refresh and try again.")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={action.isPending} className="ticket-cancel-keep">
            {tr(lang, "إلغاء", "Keep report")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={action.isPending}
            onClick={confirm}
            className="ticket-cancel-confirm"
            data-testid={`button-confirm-cancel-ticket-${ticketId}`}
          >
            <Trash2 size={15} aria-hidden="true" />
            {action.isPending
              ? tr(lang, "جارٍ الحذف…", "Deleting…")
              : tr(lang, "حذف البلاغ", "Delete report")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
