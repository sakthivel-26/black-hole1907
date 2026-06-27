import { motion } from 'framer-motion';
import { FiArrowUpCircle, FiChevronRight } from 'react-icons/fi';

interface Props {
  latestVersion: string;
  currentVersion: string;
  changelog: string[];
  apkUrl: string;
  onClose: () => void;
}

export default function UpdateModal({
  latestVersion,
  currentVersion,
  changelog,
  apkUrl,
  onClose,
}: Props) {
  const handleUpdate = () => {
    window.open(apkUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 15 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#1c1c1e]/90 p-6 shadow-[0_30px_70px_rgba(0,0,0,0.5)] backdrop-blur-3xl md:p-8"
      >
        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff375f]/15 text-[#ff375f]">
            <FiArrowUpCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Update Available!</h2>
          <p className="mt-1.5 text-sm text-white/50 font-medium">
            v{currentVersion} <span className="mx-1 text-white/30">➔</span> v{latestVersion}
          </p>
        </div>

        {/* Changelog List */}
        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.03] p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#ff375f]">What's New</p>
          <ul className="mt-3.5 space-y-3">
            {changelog.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-white/80 leading-snug">
                <FiChevronRight size={16} className="mt-0.5 shrink-0 text-[#ff375f]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Buttons */}
        <div className="mt-7 flex flex-col gap-2.5">
          <button
            onClick={handleUpdate}
            className="w-full rounded-2xl bg-gradient-to-r from-[#ff375f] to-[#ff7b00] py-3.5 text-center font-bold text-white shadow-lg shadow-[#ff375f]/20 transition hover:opacity-95 active:scale-[0.98]"
          >
            Update Now
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-center text-sm font-medium text-white/70 transition hover:bg-white/8 hover:text-white active:scale-[0.98]"
          >
            Later
          </button>
        </div>
      </motion.div>
    </div>
  );
}
