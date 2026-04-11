import { motion } from 'framer-motion';

const PageTransition = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} // Mulai sedikit di bawah
      animate={{ 
        opacity: 1, 
        y: 0,
        transition: { 
          duration: 0.5, // Cepat tapi terasa (snappy)
          ease: "easeOut" // Gerakan keluar yang natural
        } 
      }}
     
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;