"use client";

import { AlertCircle, Download, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';

interface IOSDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloadUrl: string;
  filename: string;
}

export function IOSDownloadModal({ isOpen, onClose, downloadUrl, filename }: IOSDownloadModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl border border-[#E50914]/30 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#E50914] to-[#b80710] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">iOS Download Instructions</h2>
              <p className="text-xs text-white/80">Safari requires special steps</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Alert */}
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">
              iOS Safari doesn&apos;t support direct downloads. Please follow the steps below.
            </p>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Method 1: Safari Download</h3>
            <ol className="space-y-2 text-sm text-gray-300">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E50914] text-white text-xs flex items-center justify-center font-bold">1</span>
                <span>Tap &quot;Open Link&quot; button below</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E50914] text-white text-xs flex items-center justify-center font-bold">2</span>
                <span>Long-press on the video when it opens</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E50914] text-white text-xs flex items-center justify-center font-bold">3</span>
                <span>Select &quot;Download Linked File&quot; from the menu</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E50914] text-white text-xs flex items-center justify-center font-bold">4</span>
                <span>Find your video in the Files app → Downloads</span>
              </li>
            </ol>
          </div>

          {/* Alternative Method */}
          <div className="pt-3 border-t border-gray-700 space-y-2">
            <h3 className="text-sm font-semibold text-white">Method 2: Use Download Apps</h3>
            <p className="text-xs text-gray-400">
              For easier downloads, we recommend using these apps:
            </p>
            <ul className="text-xs text-gray-400 space-y-1 ml-4">
              <li>• Documents by Readdle (Free)</li>
              <li>• iDownloader (Free)</li>
              <li>• VLC Media Player (Free, also plays videos)</li>
            </ul>
          </div>

          {/* File Info */}
          <div className="bg-gray-800/50 rounded-lg p-3 text-xs">
            <div className="text-gray-400">Downloading:</div>
            <div className="text-white font-medium truncate mt-1">{filename}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-gray-800/30 border-t border-gray-700 flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              window.open(downloadUrl, '_blank');
            }}
            className="flex-1 bg-[#E50914] hover:bg-[#b80710] text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Link
          </Button>
        </div>

        {/* Footer tip */}
        <div className="px-4 pb-4">
          <p className="text-xs text-center text-gray-500">
            💡 Tip: Keep this guide open while you complete the steps
          </p>
        </div>
      </div>
    </div>
  );
}
