import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { TokenList } from './TokenList';
import type { TokenWithPrice } from '../types';

interface TokenListModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: TokenWithPrice[];
  selectedTokens: Set<string>;
  onToggleToken: (address: string) => void;
  loading?: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRefresh: () => void;
}

export const TokenListModal = ({
  isOpen,
  onClose,
  tokens,
  selectedTokens,
  onToggleToken,
  loading,
  onSelectAll,
  onDeselectAll,
  onRefresh,
}: TokenListModalProps) => {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-200"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-[#0a0a0a] border-l border-[#222]">
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-[#222]">
                      <div className="flex items-center justify-between">
                        <Dialog.Title className="text-sm font-semibold text-white">
                          Select Tokens
                        </Dialog.Title>
                        <button
                          onClick={onClose}
                          className="p-1 rounded text-[#666] hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex gap-1.5 mt-3">
                        <button
                          onClick={onSelectAll}
                          className="px-2.5 py-1 bg-white text-black rounded text-[11px] font-medium hover:bg-[#ededed] transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          onClick={onDeselectAll}
                          className="px-2.5 py-1 bg-[#1a1a1a] text-[#888] rounded text-[11px] font-medium hover:text-white hover:bg-[#222] transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          onClick={onRefresh}
                          disabled={loading}
                          className="px-2.5 py-1 bg-[#1a1a1a] text-[#888] rounded text-[11px] font-medium hover:text-white hover:bg-[#222] transition-colors disabled:opacity-40 ml-auto"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto px-5 py-3">
                      <TokenList
                        tokens={tokens}
                        selectedTokens={selectedTokens}
                        onToggleToken={onToggleToken}
                        loading={loading}
                      />
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-[#222]">
                      <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-white text-black font-medium rounded-lg hover:bg-[#ededed] transition-colors text-sm"
                      >
                        Done ({selectedTokens.size} selected)
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
