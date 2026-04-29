import React from 'react';
import { motion } from 'framer-motion';

const SkeletonLoader = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 space-y-6 w-full">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-4">
          <motion.div 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-12 h-12 bg-slate-200 rounded-full"
          />
          <div className="space-y-2">
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }}
              className="h-4 w-32 bg-slate-200 rounded-md"
            />
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
              className="h-3 w-24 bg-slate-100 rounded-md"
            />
          </div>
        </div>
        <motion.div 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          className="h-10 w-10 bg-slate-200 rounded-full"
        />
      </div>

      {/* Content Area Skeleton */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
        {/* Title and Controls */}
        <div className="flex justify-between items-center mb-8">
          <motion.div 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            className="h-8 w-48 bg-slate-200 rounded-lg"
          />
          <div className="flex space-x-3">
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              className="h-10 w-24 bg-slate-200 rounded-xl"
            />
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
              className="h-10 w-32 bg-[#354C8F]/20 rounded-xl"
            />
          </div>
        </div>

        {/* Card Grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((item, index) => (
            <motion.div
              key={item}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 * index }}
              className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4"
            >
              <div className="h-6 w-3/4 bg-slate-200 rounded-md" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-slate-200 rounded-md" />
                <div className="h-4 w-5/6 bg-slate-200 rounded-md" />
              </div>
              <div className="pt-4 flex justify-between items-center">
                <div className="h-8 w-20 bg-slate-200 rounded-lg" />
                <div className="h-8 w-8 bg-slate-200 rounded-full" />
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Table/List Skeleton */}
        <div className="mt-8 space-y-4">
          {[1, 2, 3, 4].map((item, index) => (
            <motion.div
              key={`row-${item}`}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 * index }}
              className="flex justify-between items-center p-4 border border-slate-100 rounded-xl"
            >
              <div className="flex space-x-4 w-1/2">
                <div className="h-4 w-4 bg-slate-200 rounded-sm" />
                <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
              </div>
              <div className="flex space-x-4 w-1/4 justify-end">
                <div className="h-6 w-16 bg-slate-200 rounded-md" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonLoader;
