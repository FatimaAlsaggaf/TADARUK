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
          aria-label={tr(lang, `إلغاء البلاغ ${ticketNumber}`, `Cancel report ${ticketNumber}`)}
          data-testid={`button-cancel-ticket-${ticketId}`}
        >
          <Trash2 size={16} aria-hidden="true" />
          <span>{tr(lang, "إلغاء البلاغ", "Cancel report")}</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="ticket-cancel-dialog" dir={lang === "ar" ? "rtl" : "ltr"}>
        <AlertDialogHeader>
          <AlertDialogTitle>{tr(lang, "تأكيد إلغاء البلاغ؟", "Confirm report cancellation?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {manager
              ? tr(lang, "يمكن إلغاء البلاغ قبل بدء العمل فقط. سيبقى محفوظًا في سجل المتابعة.", "You can cancel only before work starts. The audit history is kept.")
              : tr(lang, "يمكن إلغاء البلاغ الجديد قبل بدء الصيانة. لن يُحذف سجله.", "You can cancel a new ticket before maintenance starts. Its history remains.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {action.isError && (
          <p className="ticket-cancel-error" role="alert" data-testid="status-cancel-ticket-error">
            {tr(lang, "تعذر إلغاء البلاغ. ربما بدأ العمل عليه؛ حدّث الصفحة.", "Cannot cancel this ticket. Work may have started; refresh the page.")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={action.isPending} className="ticket-cancel-keep">
            {tr(lang, "تراجع", "Keep report")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={action.isPending}
            onClick={confirm}
            className="ticket-cancel-confirm"
            data-testid={`button-confirm-cancel-ticket-${ticketId}`}
          >
            <Trash2 size={15} aria-hidden="true" />
            {action.isPending
              ? tr(lang, "جارٍ الإلغاء…", "Cancelling…")
              : tr(lang, "حذف البلاغ", "Delete report")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
