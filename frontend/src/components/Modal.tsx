"use client"

import { X } from "lucide-react"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-lg w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#e0e0e0]">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#f5f5f7] rounded-full transition-colors">
            <X className="w-4 h-4 text-[#7a7a7a]" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
