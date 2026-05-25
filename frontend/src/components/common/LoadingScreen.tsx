import { motion } from 'framer-motion';

export function LoadingScreen({ message = '로딩 중...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-dark-900 flex flex-col items-center justify-center z-50">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 border-3 border-white/20 border-t-primary rounded-full mb-4"
        style={{ borderWidth: 3 }}
      />
      <p className="text-white/60 text-sm">{message}</p>
    </div>
  );
}
