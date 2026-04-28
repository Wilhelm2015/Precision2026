import React from 'react';
import { jsPDF } from 'jspdf';

export const TemplateReportGenerator: React.FC = () => {
  const generateExampleReport = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Mix of unit types as requested
    const items = [
      { id: '1', type: 'Extinguisher', status: 'PASS', checklist: ['Vessel condition: Pass', 'Internal inspect: Pass', 'Safety pin: Pass'] },
      { id: '2', type: 'Extinguisher', status: 'FAIL', checklist: ['Vessel condition: Pass', 'Internal inspect: Fail', 'Safety pin: Pass'] },
      { id: '3', type: 'Extinguisher', status: 'CONDEMNED', checklist: ['Vessel condition: Fail', 'Wall thinning: Fail'] },
      { id: '4', type: 'Hydrant', status: 'PASS', checklist: ['Accessibility: Pass', 'Couplings: Pass', 'Caps: Pass'] },
    ];

    const totalPages = 2; // Preview just 2 pages worth for the demo
    
    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();
      
      doc.setFontSize(14);
      doc.text(`Comprehensive Example Report - Page ${page + 1}`, 20, 15);
      
      for (let i = 0; i < 4; i++) {
        const item = items[i];
        const yPos = 25 + (i * 60);
        
        doc.setDrawColor(0);
        doc.rect(20, yPos, 170, 55); // Box for record
        
        doc.setFontSize(11);
        doc.text(`Asset: ${item.type} (ID: ${item.id}) - Status: ${item.status}`, 25, yPos + 8);
        
        doc.setFontSize(9);
        item.checklist.forEach((check, cIdx) => {
          doc.text(`- ${check}`, 30, yPos + 18 + (cIdx * 6));
        });
      }
    }
    
    doc.save('Comprehensive_Example_Demo.pdf');
  };

  return (
    <button 
      onClick={generateExampleReport}
      className="bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest px-6 py-3 rounded-xl hover:bg-emerald-700 transition-all shadow-lg"
    >
      Preview Comprehensive Example PDF
    </button>
  );
};
