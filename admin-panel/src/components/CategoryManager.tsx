import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Plus, 
  Edit, 
  Trash2, 
  X,
  Layers,
  Loader2,
  UploadCloud,
  Image as ImageIcon,
  FolderOpen
} from 'lucide-react';

interface CategoryManagerProps {
  categories: any[];
  fetchMetadata: () => Promise<void>;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ categories, fetchMetadata }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Modal States
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  // Form States
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    active: true
  });
  const [assignedProductIds, setAssignedProductIds] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res: any = await api.get('/products', { params: { limit: 1000 } });
      setProducts(res.data?.data || res.data || []);
    } catch (e) {
      console.error('Failed to fetch products');
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('directory', 'categories');
      Array.from(files).forEach(file => {
        formData.append('file', file);
      });

      const res: any = await api.post('/file-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const uploadedUrls = res.data || [];
      if (uploadedUrls.length > 0) {
        setCategoryForm((prev: any) => ({
          ...prev,
          imageUrl: uploadedUrls[0]
        }));
        setMessage('Category image uploaded successfully!');
      }
    } catch (err: any) {
      setMessage(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const openAddModal = () => {
    setSelectedCategory(null);
    setCategoryForm({
      name: '',
      description: '',
      imageUrl: '',
      active: true
    });
    setShowCategoryModal(true);
    setMessage(null);
  };

  const openEditModal = (category: any) => {
    setSelectedCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      imageUrl: category.imageUrl || '',
      active: category.active ?? true
    });
    setShowCategoryModal(true);
    setMessage(null);
  };

  const openAssignModal = (category: any) => {
    setSelectedCategory(category);
    
    // Find products currently assigned to this category
    const currentlyAssigned = products
      .filter((p: any) => p.categoryId === category.id)
      .map((p: any) => p.id);
      
    setAssignedProductIds(currentlyAssigned);
    setShowAssignModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      setMessage('Name is required');
      return;
    }
    if (!categoryForm.imageUrl) {
      setMessage('Image is required');
      return;
    }

    // Name validation matching backend regex (letters and spaces only)
    if (!/^[A-Za-z ]+$/.test(categoryForm.name)) {
      setMessage('Category name must contain only alphabetic characters and spaces');
      return;
    }

    setLoading(true);
    try {
      if (selectedCategory) {
        // Edit
        await api.patch(`/categories/${selectedCategory.id}`, categoryForm);
        setMessage('Category updated successfully!');
      } else {
        // Create
        await api.post('/categories', {
          ...categoryForm,
          availableTags: ['Premium', 'Latest', 'Top Pick'] // default tags
        });
        setMessage('Category created successfully!');
      }

      await fetchMetadata();
      await fetchProducts();
      setTimeout(() => setShowCategoryModal(false), 800);
    } catch (err: any) {
      setMessage(`Action failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const assignedProductsCount = products.filter((p: any) => p.categoryId === id).length;
    let confirmMsg = `Are you sure you want to delete the category "${name}"?`;
    if (assignedProductsCount > 0) {
      confirmMsg += ` Warning: There are ${assignedProductsCount} product(s) assigned to this category. They will remain in database but category link will be deleted.`;
    }

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await api.delete(`/categories/${id}`);
      await fetchMetadata();
      await fetchProducts();
      alert('Category deleted successfully!');
    } catch (err: any) {
      alert(`Delete failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignments = async () => {
    if (!selectedCategory) return;

    setLoading(true);
    try {
      await api.post(`/categories/${selectedCategory.id}/products`, {
        productIds: assignedProductIds
      });
      
      alert('Product assignments updated successfully!');
      await fetchProducts();
      setShowAssignModal(false);
    } catch (err: any) {
      alert(`Failed to save assignments: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleProductAssignment = (productId: string) => {
    setAssignedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800">Category Catalog</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Manage product categories, upload thumbnails, and assign catalog items.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-primary hover:bg-primary-dark text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => {
          const productCount = products.filter((p: any) => p.categoryId === category.id).length;
          return (
            <div key={category.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="relative h-40 bg-slate-100 border-b border-slate-100 overflow-hidden">
                  {category.imageUrl ? (
                    <img 
                      src={category.imageUrl} 
                      alt={category.name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded-full border uppercase tracking-wider ${
                      category.active 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      {category.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="p-5 space-y-2">
                  <h4 className="font-extrabold text-slate-800 text-sm">{category.name}</h4>
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {category.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0 border-t border-slate-50 mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs">
                  <Layers className="w-4 h-4 text-primary/80" />
                  <span>{productCount} Products</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openAssignModal(category)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-primary hover:text-primary-dark rounded-xl transition-all cursor-pointer"
                    title="Assign Products"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(category)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
                    title="Edit Category"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id, category.name)}
                    className="p-2 bg-red-50 hover:bg-red-100 text-danger rounded-xl transition-all cursor-pointer"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Category Creation / Edit Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden z-10 flex flex-col p-6 animate-fade-in text-xs">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  {selectedCategory ? 'Edit Category' : 'Add Category'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Category details must align with product tags and classifications.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCategoryModal(false)} 
                className="p-1 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploading && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-xl mb-4 text-primary font-bold animate-pulse justify-center text-[10px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading thumbnail to server...</span>
              </div>
            )}

            {message && (
              <div className={`p-3 rounded-xl mb-4 font-semibold text-center border ${
                message.includes('success') 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                  : 'bg-red-50 text-danger border-red-100'
              }`}>
                {message}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Category Title / Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Smart Devices" 
                  value={categoryForm.name} 
                  onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all font-semibold text-slate-700" 
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Description</label>
                <textarea 
                  rows={3}
                  placeholder="Summarize what products go under this category..."
                  value={categoryForm.description} 
                  onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all text-slate-600" 
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Category Thumbnail (Image)</label>
                {categoryForm.imageUrl ? (
                  <div className="relative w-full h-32 rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-end bg-white">
                    <img 
                      src={categoryForm.imageUrl} 
                      alt="Thumbnail Preview" 
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end justify-between p-2.5">
                      <span className="text-[9px] font-bold text-white uppercase tracking-wider">Thumbnail</span>
                      <button 
                        type="button" 
                        onClick={() => setCategoryForm({...categoryForm, imageUrl: ''})} 
                        className="p-1 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-sm transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
                    onClick={() => document.getElementById('category-file-input')?.click()}
                    className="border-2 border-dashed border-slate-200 bg-white hover:border-primary hover:bg-slate-50/50 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 h-32"
                  >
                    <input 
                      id="category-file-input" 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload(e.target.files)} 
                      className="hidden" 
                    />
                    <UploadCloud className="w-6 h-6 text-slate-400" />
                    <div>
                      <p className="font-bold text-slate-700 text-[10px]">Upload category thumbnail</p>
                      <p className="text-[8px] text-slate-400 mt-0.5">Drag & drop or click</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  id="category-active"
                  type="checkbox" 
                  checked={categoryForm.active}
                  onChange={(e) => setCategoryForm({...categoryForm, active: e.target.checked})}
                  className="rounded text-primary focus:ring-primary h-4 w-4 border-slate-300"
                />
                <label htmlFor="category-active" className="text-slate-600 font-bold select-none cursor-pointer">
                  Activate Category (Visible on Storefront)
                </label>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Products Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAssignModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden z-10 flex flex-col p-6 animate-fade-in text-xs h-[80vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 flex-shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  Assign Products: {selectedCategory?.name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Select products to associate them with this category.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAssignModal(false)} 
                className="p-1 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Checklist Scroll Area */}
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2 mb-4 scrollbar-thin">
              {products.length > 0 ? (
                products.map((product) => {
                  const isAssigned = assignedProductIds.includes(product.id);
                  const belongsToOtherCategory = product.categoryId && product.categoryId !== selectedCategory?.id;
                  
                  return (
                    <div 
                      key={product.id}
                      onClick={() => toggleProductAssignment(product.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        isAssigned 
                          ? 'border-primary/50 bg-blue-50/20' 
                          : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          checked={isAssigned}
                          readOnly
                          className="rounded text-primary focus:ring-primary h-4 w-4 border-slate-300 pointer-events-none"
                        />
                        <div className="flex items-center gap-2">
                          {product.thumbnailImageUrl && (
                            <img src={product.thumbnailImageUrl} className="w-7 h-7 object-cover rounded-md border" alt="" />
                          )}
                          <div>
                            <p className="font-bold text-slate-800 truncate max-w-64">{product.name}</p>
                            <p className="text-[9px] text-slate-400">Brand: {product.brand?.name || 'Unknown'}</p>
                          </div>
                        </div>
                      </div>
                      
                      {belongsToOtherCategory && !isAssigned && (
                        <span className="text-[8px] bg-amber-50 text-amber-600 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                          Reassign Category
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400">
                  No products uploaded in catalog.
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAssignments}
                disabled={loading}
                className="px-5 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Assignments
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
