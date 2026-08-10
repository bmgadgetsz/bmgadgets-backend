import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Plus, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  PlusCircle,
  Eye,
  Upload,
  ImageIcon,
  Loader2
} from 'lucide-react';

export const CmsManager: React.FC = () => {
  const [cmsTab, setCmsTab] = useState<'carousel' | 'featured' | 'serve' | 'certifications'>('carousel');
  
  // Data lists
  const [carousels, setCarousels] = useState<any[]>([]);
  const [featureds, setFeatureds] = useState<any[]>([]);
  const [serves, setServes] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);

  // Modals & Upload Loading
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Forms state
  const [title, setTitle] = useState('');
  const [slides, setSlides] = useState<any[]>([{ url: '', altText: '', href: '' }]);
  const [cards, setCards] = useState<any[]>([{ graphicUrl: '', text: '', subText: '' }]);

  const fetchCmsTabRecords = async () => {
    setLoading(true);
    try {
      if (cmsTab === 'carousel') {
        const res: any = await api.get('/cms/carousel');
        setCarousels(res.data?.data || res.data || []);
      } else if (cmsTab === 'featured') {
        const res: any = await api.get('/cms/featured');
        setFeatureds(res.data?.data || res.data || []);
      } else if (cmsTab === 'serve') {
        const res: any = await api.get('/cms/serve');
        setServes(res.data?.data || res.data || []);
      } else {
        const res: any = await api.get('/cms/certification');
        setCerts(res.data?.data || res.data || []);
      }
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCmsTabRecords();
  }, [cmsTab]);

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      if (cmsTab === 'carousel') {
        await api.patch(`/cms/carousel/${id}`, { active: !currentActive });
      } else if (cmsTab === 'featured') {
        await api.patch(`/cms/featured/${id}`, { active: !currentActive });
      } else if (cmsTab === 'serve') {
        await api.patch(`/cms/serve/${id}`, { active: !currentActive });
      } else {
        await api.patch(`/cms/certification/${id}`, { active: !currentActive });
      }
      setMessage('Homepage layout configuration updated!');
      fetchCmsTabRecords();
    } catch (err: any) {
      setMessage(err.message || 'Action rejected by server.');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Remove this block layout permanently?')) return;
    try {
      if (cmsTab === 'carousel') {
        await api.delete(`/cms/carousel/${id}`);
      } else if (cmsTab === 'featured') {
        await api.delete(`/cms/featured/${id}`);
      } else if (cmsTab === 'serve') {
        await api.delete(`/cms/serve/${id}`);
      } else {
        await api.delete(`/cms/certification/${id}`);
      }
      setMessage('Marketing block layout deleted.');
      fetchCmsTabRecords();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  // Upload file directly to AWS S3 via POST /v1/common/file-upload
  const handleFileUpload = async (index: number, file: File) => {
    setUploadingIndex(index);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('directory', 'cms');

      const res: any = await api.post('/common/file-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const uploadedUrl = res.data?.[0] || res.data;
      if (uploadedUrl) {
        const newSlides = [...slides];
        newSlides[index].url = uploadedUrl;
        setSlides(newSlides);
        setMessage('Image uploaded to AWS S3 successfully!');
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to upload image file');
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      // Strictly formatted customImage payload matching Zod schema: { url: string, href: string, altText: string }
      const cleanMediaPayload = slides.map((s) => ({
        url: s.url.trim(),
        href: (s.href || '').trim(),
        altText: (s.altText || title).trim()
      }));

      if (cmsTab === 'carousel') {
        // Backend Zod schema expects ONLY: { title: string, media: array, active: boolean }
        await api.post('/cms/carousel', {
          title: title.trim(),
          media: cleanMediaPayload,
          active: true
        });
      } else if (cmsTab === 'serve') {
        await api.post('/cms/serve', {
          title: title.trim(),
          features: cards.map((c) => ({
            graphicUrl: c.graphicUrl.trim(),
            text: c.text.trim(),
            subText: c.subText.trim()
          })),
          active: true
        });
      } else if (cmsTab === 'certifications') {
        await api.post('/cms/certification', {
          title: title.trim(),
          media: cleanMediaPayload[0],
          active: true
        });
      } else if (cmsTab === 'featured') {
        await api.post('/cms/featured', {
          title: title.trim(),
          squareCarousel: cleanMediaPayload,
          horizontalCarousel: cleanMediaPayload,
          staticImage1: cleanMediaPayload[0],
          staticImage2: cleanMediaPayload[0],
          active: true
        });
      }

      setMessage('Homepage block created & activated!');
      setShowModal(false);
      fetchCmsTabRecords();
    } catch (err: any) {
      setMessage(err.message || 'Validation Error: Check all required fields.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlideInput = () => {
    setSlides([...slides, { url: '', altText: '', href: '' }]);
  };

  const handleRemoveSlideInput = (index: number) => {
    if (slides.length === 1) return;
    setSlides(slides.filter((_, i) => i !== index));
  };

  const handleAddCardInput = () => {
    setCards([...cards, { graphicUrl: '', text: '', subText: '' }]);
  };

  const openCreateModal = () => {
    setTitle('');
    setSlides([{ url: '', altText: 'Promo Banner', href: '/products' }]);
    setCards([{ graphicUrl: '', text: 'Target Segment', subText: 'Description text' }]);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Alert logs */}
      {message && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs flex justify-between items-center shadow-sm">
          <span className="font-medium">{message}</span>
          <button onClick={() => setMessage(null)} className="font-bold text-blue-900 hover:underline">
            Close
          </button>
        </div>
      )}

      {/* Block tab navigation */}
      <div className="flex border-b border-slate-200">
        {(['carousel', 'featured', 'serve', 'certifications'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setCmsTab(t)}
            className={`px-5 py-3 font-semibold text-xs border-b-2 tracking-wider uppercase transition-all ${
              cmsTab === t ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t} Layouts
          </button>
        ))}
      </div>

      {/* Toolbar actions */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h3 className="font-extrabold text-slate-800 text-sm">Marketing Blocks Manager</h3>
          <p className="text-[10px] text-slate-400">Configure sliders, banner images & direct page link paths</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-primary hover:bg-primary-dark text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Layout Block
        </button>
      </div>

      {/* Active layout records */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cmsTab === 'carousel' && carousels.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-4">
            <div>
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                <button onClick={() => handleToggleActive(item.id, item.active)}>
                  {item.active ? (
                    <ToggleRight className="w-8 h-8 text-primary" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {item.media?.map((slide: any, idx: number) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <img src={slide.url} alt="" className="w-28 h-16 object-cover rounded-lg border" />
                    {slide.href && (
                      <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] font-mono px-1 rounded truncate max-w-[100px]">
                        {slide.href}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-3 border-t text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider">{item.media?.length || 0} Slides</span>
              <button onClick={() => handleDeleteItem(item.id)} className="text-rose-500 hover:text-rose-700">
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        ))}

        {cmsTab === 'serve' && serves.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-4">
            <div>
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                <button onClick={() => handleToggleActive(item.id, item.active)}>
                  {item.active ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {item.features?.map((f: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl">
                    <img src={f.graphicUrl} alt="" className="w-8 h-8 object-cover rounded-lg" />
                    <div>
                      <p className="font-bold text-xs text-slate-700">{f.text}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{f.subText}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-3 border-t text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider">{item.features?.length || 0} Audience features</span>
              <button onClick={() => handleDeleteItem(item.id)} className="text-rose-500 hover:text-rose-700">
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        ))}

        {cmsTab === 'certifications' && certs.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={item.media?.url} alt="" className="w-16 h-16 object-cover rounded-xl border" />
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">{item.id}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => handleToggleActive(item.id, item.active)}>
                {item.active ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
              </button>
              <button onClick={() => handleDeleteItem(item.id)} className="text-rose-500 hover:text-rose-700">
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        ))}

        {cmsTab === 'featured' && featureds.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-slate-400" />
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                <p className="text-[10px] text-slate-400">Featured promotional collection grids</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => handleToggleActive(item.id, item.active)}>
                {item.active ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
              </button>
              <button onClick={() => handleDeleteItem(item.id)} className="text-rose-500 hover:text-rose-700">
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Creation Block Modal with S3 File Upload & Simple Href Link Input */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto z-10 p-6">
            <h3 className="text-base font-black text-slate-800 mb-5 uppercase tracking-tight">
              Create Custom {cmsTab} Block
            </h3>
            
            <form onSubmit={handleSaveBlock} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Layout Title *</label>
                <input 
                  type="text" 
                  required 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm outline-none focus:border-primary" 
                  placeholder="e.g. Clearance Deals Grid" 
                />
              </div>

              {cmsTab === 'carousel' || cmsTab === 'certifications' || cmsTab === 'featured' ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-slate-700 font-bold">Image Uploads / Slide Elements</label>
                    {cmsTab === 'carousel' && (
                      <button type="button" onClick={handleAddSlideInput} className="text-primary font-bold flex items-center gap-1 hover:underline">
                        <PlusCircle className="w-4 h-4" /> Add Slide
                      </button>
                    )}
                  </div>

                  {slides.map((s, index) => (
                    <div key={index} className="p-3.5 bg-slate-50 rounded-xl space-y-3 border border-slate-200">
                      <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                        <span>Slide #{index + 1}</span>
                        {slides.length > 1 && (
                          <button type="button" onClick={() => handleRemoveSlideInput(index)} className="text-rose-500 hover:text-rose-700">
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Image Input + Upload Button + Preview */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                        <div className="relative aspect-video rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
                          {s.url ? (
                            <img src={s.url} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center p-2 text-slate-400">
                              <ImageIcon className="w-5 h-5 mx-auto mb-1" />
                              <span className="text-[10px]">No Artwork</span>
                            </div>
                          )}
                        </div>

                        <div className="sm:col-span-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition">
                              {uploadingIndex === index ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Upload className="w-3.5 h-3.5" />
                              )}
                              Upload Image File
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) handleFileUpload(index, e.target.files[0]);
                                }}
                              />
                            </label>
                            <span className="text-[10px] text-slate-400">or paste URL:</span>
                          </div>

                          <input 
                            type="text" 
                            required
                            placeholder="Image URL (https://...)" 
                            value={s.url} 
                            onChange={(e) => {
                              const newSlides = [...slides];
                              newSlides[index].url = e.target.value;
                              setSlides(newSlides);
                            }} 
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700" 
                          />
                        </div>
                      </div>

                      {/* Click Path Href + Alt Text */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Click Path (href)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. /products or /categories/123 or https://..." 
                            value={s.href} 
                            onChange={(e) => {
                              const newSlides = [...slides];
                              newSlides[index].href = e.target.value;
                              setSlides(newSlides);
                            }} 
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700" 
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Accessibility Alt Text</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Promo Offer" 
                            value={s.altText} 
                            onChange={(e) => {
                              const newSlides = [...slides];
                              newSlides[index].altText = e.target.value;
                              setSlides(newSlides);
                            }} 
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700" 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-slate-700 font-bold">Target Segment Cards</label>
                    <button type="button" onClick={handleAddCardInput} className="text-primary font-bold flex items-center gap-1 hover:underline">
                      <PlusCircle className="w-4 h-4" /> Add Card
                    </button>
                  </div>
                  {cards.map((c, index) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                      <input type="text" placeholder="Graphic Icon Link" value={c.graphicUrl} onChange={(e) => {
                        const newCards = [...cards];
                        newCards[index].graphicUrl = e.target.value;
                        setCards(newCards);
                      }} className="w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input type="text" placeholder="Card Title" value={c.text} onChange={(e) => {
                          const newCards = [...cards];
                          newCards[index].text = e.target.value;
                          setCards(newCards);
                        }} className="w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs" />
                        <input type="text" placeholder="Sub-text Description" value={c.subText} onChange={(e) => {
                          const newCards = [...cards];
                          newCards[index].subText = e.target.value;
                          setCards(newCards);
                        }} className="w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-500 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-md transition-all">
                  {loading ? 'Saving...' : 'Save & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
