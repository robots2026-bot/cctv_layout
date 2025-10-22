import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useEffect, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';

const AliasDialog = () => {
  const { aliasDialog, aliasDialogSubmitting, closeAliasDialog, setAliasDialogSubmitting } = useUIStore(
    (state) => ({
      aliasDialog: state.aliasDialog,
      aliasDialogSubmitting: state.aliasDialogSubmitting,
      closeAliasDialog: state.closeAliasDialog,
      setAliasDialogSubmitting: state.setAliasDialogSubmitting
    })
  );
  const [value, setValue] = useState(aliasDialog.initialValue ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (aliasDialog.isOpen) {
      setValue(aliasDialog.initialValue ?? '');
      setError(null);
    }
  }, [aliasDialog.isOpen, aliasDialog.initialValue]);

  const handleClose = () => {
    if (aliasDialogSubmitting) return;
    closeAliasDialog();
  };

  const handleConfirm = async () => {
    if (!aliasDialog.onConfirm) {
      closeAliasDialog();
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      setError('别名不能为空');
      return;
    }
    setAliasDialogSubmitting(true);
    try {
      await aliasDialog.onConfirm(trimmed);
      closeAliasDialog();
    } catch (err) {
      console.error('提交别名失败', err);
      setError(err instanceof Error ? err.message : '提交失败，请稍后重试');
    } finally {
      setAliasDialogSubmitting(false);
    }
  };

  return (
    <Transition appear show={aliasDialog.isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-10 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-2 scale-95"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-2 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title className="text-lg font-semibold text-slate-100">
                  {aliasDialog.title}
                </Dialog.Title>
                {aliasDialog.description && (
                  <p className="mt-1 text-sm text-slate-400">{aliasDialog.description}</p>
                )}
                <div className="mt-4 space-y-2">
                  <input
                    type="text"
                    value={value}
                    onChange={(event) => {
                      setValue(event.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={aliasDialog.placeholder ?? '输入设备别名'}
                    autoFocus
                    className="w-full rounded border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none"
                    disabled={aliasDialogSubmitting}
                  />
                  {error && <div className="text-xs text-rose-400">{error}</div>}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={aliasDialogSubmitting}
                    className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={aliasDialogSubmitting}
                    className="rounded border border-brand-500/70 bg-brand-500/20 px-3 py-1.5 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {aliasDialogSubmitting ? '保存中...' : aliasDialog.confirmLabel}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AliasDialog;
