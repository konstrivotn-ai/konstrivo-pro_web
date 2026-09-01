import React, { useState } from 'react';
import { 
  ArrowRight, Search, MapPin, CheckCircle2, 
  Layers, HardHat, ShieldCheck, PhoneCall, Sparkles,
  ChevronRight, Wrench, Paintbrush, Home, Building, Zap
} from 'lucide-react';
import { Language } from '../types';

interface ServicesTabProps {
  onNavigate: (tabId: string) => void;
  lang: Language;
}

export const ServicesTab: React.FC<ServicesTabProps> = ({
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [locationTerm, setLocationTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const servicesList = [
    {
      id: 'placo',
      title: 'Placo & Plaques de plâtre',
      description: 'Pose de plaques, cloisons, doublage, aménagement intérieur.',
      image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
      badge: 'BA13 / BA15',
      category: 'placo'
    },
    {
      id: 'faux_plafond',
      title: 'Faux plafond',
      description: 'Faux plafonds simples, décoratifs, solutions techniques.',
      image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      badge: 'Gorge & LED',
      category: 'placo'
    },
    {
      id: 'cloison',
      title: 'Cloison & Séparation',
      description: 'Cloisons fixes, démontables, organisation des espaces.',
      image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80',
      badge: 'M48 / M70',
      category: 'cloison'
    },
    {
      id: 'isolation',
      title: 'Isolation',
      description: 'Solutions d’isolation thermique et acoustique.',
      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
      badge: 'Laine minérale',
      category: 'isolation'
    },
    {
      id: 'decoration',
      title: 'Décoration intérieure',
      description: 'Habillage mural, finitions.',
      image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
      badge: 'Sur-mesure',
      category: 'decoration'
    },
    {
      id: 'peinture',
      title: 'Peinture & Finitions',
      description: 'Finition, rénovation surfaces.',
      image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=800&q=80',
      badge: 'Enduit & Laque',
      category: 'peinture'
    },
    {
      id: 'renovation',
      title: 'Rénovation',
      description: 'Transformer, moderniser les espaces existants.',
      image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
      badge: 'Clé en main',
      category: 'renovation'
    },
    {
      id: 'construction',
      title: 'Construction',
      description: 'Différents travaux de construction et gros œuvre.',
      image: 'https://images.unsplash.com/photo-1541888946425-d0fbb180c5f7?auto=format&fit=crop&w=800&q=80',
      badge: 'Structure',
      category: 'construction'
    }
  ];

  const filteredServices = servicesList.filter((s) => {
    const matchSearch = searchTerm === '' || s.title.toLowerCase().includes(searchTerm.toLowerCase()) || s.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === 'all' || s.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-12 pb-12">
      
      {/* 1. HERO SECTION (Matching service.jpg 1:1) */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0b0f17] shadow-2xl p-6 sm:p-12 lg:p-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              SERVICES DU BÂTIMENT
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Tous les services du <br />
              bâtiment, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">au même endroit.</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              Trouvez les compétences, les professionnels et les solutions nécessaires pour réaliser vos projets de construction, rénovation et décoration.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => {
                  const target = document.getElementById('service-discovery');
                  target?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Trouver un service</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('directory_market')}
                className="px-6 py-3.5 bg-transparent hover:bg-slate-800 text-white font-bold text-sm rounded-2xl border border-slate-700 hover:border-slate-500 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Voir les professionnels</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Right Hero Image Card */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden border border-slate-700 shadow-2xl h-72 sm:h-80">
              <img
                src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=80"
                alt="Chantier de construction"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f17] via-transparent to-transparent" />
            </div>
          </div>

        </div>
      </section>

      {/* 2. NOS SERVICES (8 Photorealistic Cards Grid) */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">Nos services</h2>
          <p className="text-sm text-slate-400 mt-1">
            Des solutions adaptées à chaque étape de votre projet.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredServices.map((srv) => (
            <div
              key={srv.id}
              onClick={() => onNavigate('calculator')}
              className="bg-[#131b2e] border border-slate-800 hover:border-amber-500/60 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 cursor-pointer group flex flex-col justify-between"
            >
              {/* Card Photo Header */}
              <div className="relative h-44 overflow-hidden">
                <img
                  src={srv.image}
                  alt={srv.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#131b2e] via-transparent to-transparent" />
                
                {/* Gold Tag */}
                <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-amber-500/40 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {srv.badge}
                </div>
              </div>

              {/* Card Content */}
              <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                    {srv.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {srv.description}
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-amber-300 border-t border-slate-800/80">
                  <span>Calculer le métré</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. SERVICE DISCOVERY SEARCH BAR (Matching service.jpg 1:1) */}
      <section id="service-discovery" className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Service discovery</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Que recherchez-vous? */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Que recherchez-vous ?</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un service..."
                className="w-full bg-[#0b0f17] border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Où? (Ville / Gouvernorat) */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Où ?</label>
            <div className="relative">
              <input
                type="text"
                value={locationTerm}
                onChange={(e) => setLocationTerm(e.target.value)}
                placeholder="(Ville / Gouvernorat)"
                className="w-full bg-[#0b0f17] border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Catégorie Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Catégorie</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#0b0f17] border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="all">Toutes les catégories</option>
              <option value="placo">Placo & Plâtre</option>
              <option value="cloison">Cloisons</option>
              <option value="isolation">Isolation</option>
              <option value="peinture">Peinture</option>
              <option value="renovation">Rénovation</option>
              <option value="construction">Construction</option>
            </select>
          </div>

          {/* Rechercher Button */}
          <div className="flex items-end">
            <button
              onClick={() => {
                const resultsSection = document.getElementById('service-discovery');
                resultsSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Rechercher</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

        </div>
      </section>

      {/* 4. HOW IT WORKS (4 STEPS from screenshot) */}
      <section className="space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">How it works</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 space-y-3 relative group hover:border-amber-500/40 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center">
              1
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Recherchez</h3>
              <p className="text-xs text-slate-400 mt-1">service adapté</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </div>

          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 space-y-3 relative group hover:border-amber-500/40 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center">
              2
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Comparez</h3>
              <p className="text-xs text-slate-400 mt-1">professionnels disponibles</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </div>

          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 space-y-3 relative group hover:border-amber-500/40 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center">
              3
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Contactez</h3>
              <p className="text-xs text-slate-400 mt-1">échanges directs</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </div>

          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 space-y-3 relative group hover:border-amber-500/40 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center">
              4
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Réalisez</h3>
              <p className="text-xs text-slate-400 mt-1">solution adaptée</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </div>

        </div>
      </section>

      {/* 5. BOTTOM CTA BANNER: Vous êtes un professionnel du bâtiment ? */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0b0f17] p-8 sm:p-12 shadow-2xl">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1541888946425-d0fbb180c5f7?auto=format&fit=crop&w=1600&q=80')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f17] via-[#0b0f17]/90 to-transparent" />

        <div className="relative z-10 max-w-2xl space-y-4">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Vous êtes un professionnel <br />
            du bâtiment ?
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Présentez vos services, développez votre activité et trouvez de nouvelles opportunités avec KONSTRIVO.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => onNavigate('directory_market')}
              className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Rejoindre KONSTRIVO</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('about')}
              className="px-6 py-3 bg-[#131b2e] hover:bg-slate-800 text-white font-bold text-xs rounded-2xl border border-slate-700 transition-all cursor-pointer"
            >
              <span>Découvrir les avantages</span>
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
