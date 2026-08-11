import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X,
  Eye,
  RotateCcw,
  ShoppingCart,
  Award,
  Sparkles,
  UploadCloud,
  Info,
  Image as ImageIcon,
  FileText,
  Layers,
  Loader2,
  Box,
  Tag,
  Flame,
  Star,
  MessageSquare,
  Link as LinkIcon,
  Wand2,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';




import { CategoryManager } from './CategoryManager';

export const ProductList: React.FC = () => {
  const [subTab, setSubTab] = useState<'catalog' | 'combos' | 'categories'>('catalog');
  const [products, setProducts] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [hsns, setHsns] = useState<any[]>([]);
  const [globalVariants, setGlobalVariants] = useState<any[]>([]);
  const [subCategoriesList, setSubCategoriesList] = useState<any[]>([]);
  const allSubCategories = [
    ...subCategoriesList,
    ...categories.reduce((acc: any[], cat: any) => {
      if (cat.subCategories && Array.isArray(cat.subCategories)) {
        const mapped = cat.subCategories.map((sub: any) => ({
          ...sub,
          categoryName: cat.name
        }));
        return [...acc, ...mapped];
      }
      return acc;
    }, [])
  ];

  // Search/Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Selection/Modals
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showComboModal, setShowComboModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchMetadata = async () => {
    try {
      const [brandRes, catRes, subCatRes, hsnRes, varRes] = await Promise.all([
        api.get('/brands', { params: { limit: 100 } }),
        api.get('/categories'),
        api.get('/sub-categories', { params: { limit: 100 } }),
        api.get('/hsn-config'),
        api.get('/variants'),
      ]);
      setBrands(brandRes.data?.data || brandRes.data || []);
      setCategories(catRes.data?.data || catRes.data || []);
      setSubCategoriesList(subCatRes.data?.data || subCatRes.data || []);
      setHsns(hsnRes.data?.data || hsnRes.data || []);
      setGlobalVariants(varRes.data?.data || varRes.data || []);
    } catch (e) {
      console.error('Failed to load auxiliary forms metadata');
    }
  };

  const getOrCreateSubCategoryId = async (targetCategoryId?: string): Promise<string> => {
    const catId = targetCategoryId || productForm.categoryId || categories[0]?.id;
    
    // 1. Try existing subcategory
    const existing = subCategoriesList.find((s: any) => s.categoryId === catId) || 
                     allSubCategories.find((s: any) => s.categoryId === catId) ||
                     subCategoriesList[0] || 
                     allSubCategories[0];

    if (existing && existing.id) {
      return existing.id;
    }

    // 2. Auto-create fallback category if none exists
    let resolvedCatId = catId;
    if (!resolvedCatId) {
      try {
        const newCatRes: any = await api.post('/categories', {
          name: 'General Category',
          imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200',
          description: 'Default category for products',
          availableTags: ['general']
        });
        const createdCat = newCatRes.data || newCatRes;
        resolvedCatId = createdCat.id;
        setCategories((prev: any) => [...prev, createdCat]);
        setProductForm((prev: any) => ({ ...prev, categoryId: createdCat.id }));
      } catch (catErr) {
        console.error("Failed auto-creating fallback category:", catErr);
      }
    }

    // 3. Auto-create fallback subcategory
    if (resolvedCatId) {
      try {
        const res: any = await api.post('/sub-categories', {
          name: `General SubCategory`,
          description: 'Auto-created subcategory for product variants',
          categoryId: resolvedCatId
        });
        const newSub = res.data || res;
        setSubCategoriesList((prev: any) => [...prev, newSub]);
        return newSub.id;
      } catch (subErr) {
        console.error("Failed auto-creating fallback subcategory:", subErr);
      }
    }

    return "";
  };  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Quick Stock Modal state
  const [stockModalProduct, setStockModalProduct] = useState<any>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockInputs, setStockInputs] = useState<{ [variantId: string]: number }>({});
  const [savingStock, setSavingStock] = useState(false);

  // Quick Price & Offer Modal state
  const [priceModalProduct, setPriceModalProduct] = useState<any>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceInputs, setPriceInputs] = useState<{ [variantId: string]: { price: number; discountPercentage: number; finalPrice?: number } }>({});
  const [savingPrice, setSavingPrice] = useState(false);

  // Paginated Product Reviews Modal state
  const [reviewsModalProduct, setReviewsModalProduct] = useState<any>(null);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [productReviews, setProductReviews] = useState<any[]>([]);
  const [reviewsMeta, setReviewsMeta] = useState<{ total: number; page: number; limit: number }>({ total: 0, page: 1, limit: 5 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  // Link auto-fill state
  const [pastedLink, setPastedLink] = useState('');
  const [fetchingLink, setFetchingLink] = useState(false);
  const [linkFetchSuccess, setLinkFetchSuccess] = useState<string | null>(null);

  const getVariantDisplayName = (item: any) => {
    if (!item) return 'Standard';
    const candidates = [
      item.variant?.name,
      item.variantName,
      item.name
    ].filter((n) => typeof n === 'string' && n.trim().length > 0);

    const cleanName = candidates.find((n) => n.trim() !== '100W GaN Desktop Station');
    if (cleanName) return cleanName;

    if (item.weightInGrams && Number(item.weightInGrams) > 0) {
      return `${item.weightInGrams}g Pack`;
    }
    return 'Standard';
  };

  // Forms states
  const [productForm, setProductForm] = useState<any>({
    name: '', brandId: '', hsnId: '', tags: '', originCountry: 'India',
    description: '', ingredients: '', healthBenefits: '', usageInstructions: '', storageInstructions: '',
    certifications: [], thumbnailImageUrl: '', imageUrls: [], attributes: '', active: true,
    videoUrl: '', varients: [], categoryId: ''
  });
  const [draftVariant, setDraftVariant] = useState<any>({
    variantId: '', variantName: '', subCategoryId: '', discountPercentage: 0, mfgDate: '', expiryDate: '', weightInGrams: 100, price: 1000
  });
  const [comboForm, setComboForm] = useState<any>({
    name: '', description: '', imageUrl: '', weightInGrams: 0, price: 0, productVariantIds: [], productId: ''
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: any = {
        search: search || undefined,
        categoryId: categoryFilter || undefined,
        isAdmin: 'true',
      };
      if (statusFilter === 'active') params.active = 'true';
      if (statusFilter === 'inactive') params.active = 'false';

      const res: any = await api.get('/products', { params });
      setProducts(res.data?.data || res.data || []);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };


  const getProductTotalStock = (prod: any) => {
    if (!prod?.varients || !Array.isArray(prod.varients)) return 0;
    return prod.varients.reduce((sum: number, v: any) => {
      const vStock = (v.warehouseStocks || []).reduce((wsSum: number, ws: any) => wsSum + (ws.productCount || 0), 0);
      return sum + vStock;
    }, 0);
  };

  const openStockModal = (prod: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStockModalProduct(prod);
    const initialInputs: { [variantId: string]: number } = {};
    (prod.varients || []).forEach((v: any) => {
      const currentStock = (v.warehouseStocks || []).reduce((wsSum: number, ws: any) => wsSum + (ws.productCount || 0), 0);
      initialInputs[v.id] = currentStock;
    });
    setStockInputs(initialInputs);
    setShowStockModal(true);
  };

  const handleSaveVariantStock = async (variantId: string) => {
    setSavingStock(true);
    try {
      const count = Number(stockInputs[variantId] || 0);
      await api.post('/warehouse-stocks/upsert', {
        productVariantId: variantId,
        productCount: count
      });
      setMessage('Stock quantity updated successfully!');
      
      // Update state locally
      setProducts((prev) => prev.map((p) => {
        if (p.id === stockModalProduct.id) {
          const updatedVarients = (p.varients || []).map((v: any) => {
            if (v.id === variantId) {
              return { ...v, warehouseStocks: [{ productCount: count }] };
            }
            return v;
          });
          return { ...p, varients: updatedVarients };
        }
        return p;
      }));
      setStockModalProduct((prev: any) => {
        if (!prev) return prev;
        const updatedVarients = (prev.varients || []).map((v: any) => {
          if (v.id === variantId) {
            return { ...v, warehouseStocks: [{ productCount: count }] };
          }
          return v;
        });
        return { ...prev, varients: updatedVarients };
      });
    } catch (err: any) {
      setMessage(`Failed to update stock: ${err.message}`);
    } finally {
      setSavingStock(false);
    }
  };

  const openPriceModal = (prod: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPriceModalProduct(prod);
    const initialInputs: { [variantId: string]: { price: number; discountPercentage: number; finalPrice: number } } = {};
    (prod.varients || []).forEach((v: any) => {
      const currentPrice = v.prices?.[0]?.price || 0;
      const currentDiscount = v.discountPercentage || 0;
      const currentFinal = v.prices?.[0]?.discountedPrice ?? Math.round(currentPrice * (1 - currentDiscount / 100));
      initialInputs[v.id] = { price: currentPrice, discountPercentage: currentDiscount, finalPrice: currentFinal };
    });
    setPriceInputs(initialInputs);
    setShowPriceModal(true);
  };

  const handleSaveVariantPriceAndOffer = async (v: any) => {
    setSavingPrice(true);
    try {
      const currentInputs = priceInputs[v.id] || { price: 0, discountPercentage: 0 };
      const priceVal = Number(currentInputs.price || 0);
      const discountVal = Number(currentInputs.discountPercentage || 0);
      const targetMasterVariantId = v.variantId || v.variant?.id;

      await api.patch(`/products/${priceModalProduct.id}/variants/${targetMasterVariantId}`, {
        price: priceVal,
        discountPercentage: discountVal
      });

      setMessage(`Price & Offer for "${v.variant?.name || 'variant'}" updated successfully!`);

      const calcDiscounted = Math.round(priceVal * (1 - discountVal / 100));

      // Update state locally
      setProducts((prev) => prev.map((p) => {
        if (p.id === priceModalProduct.id) {
          const updatedVarients = (p.varients || []).map((item: any) => {
            if (item.id === v.id) {
              return {
                ...item,
                discountPercentage: discountVal,
                prices: [{ price: priceVal, discountedPrice: calcDiscounted }]
              };
            }
            return item;
          });
          return { ...p, varients: updatedVarients };
        }
        return p;
      }));

      setPriceModalProduct((prev: any) => {
        if (!prev) return prev;
        const updatedVarients = (prev.varients || []).map((item: any) => {
          if (item.id === v.id) {
            return {
              ...item,
              discountPercentage: discountVal,
              prices: [{ price: priceVal, discountedPrice: calcDiscounted }]
            };
          }
          return item;
        });
        return { ...prev, varients: updatedVarients };
      });
    } catch (err: any) {
      setMessage(`Failed to update price & offer: ${err.message}`);
    } finally {
      setSavingPrice(false);
    }
  };

  const fetchProductReviews = async (productId: string, page = 1) => {
    setReviewsLoading(true);
    try {
      const res: any = await api.get('/review', {
        params: {
          productId,
          page,
          limit: 5,
          isAdmin: 'true'
        }
      });
      const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      const metaData = res.meta || res.data?.meta || { total: list.length, page, limit: 5 };
      setProductReviews(list);
      setReviewsMeta(metaData);
    } catch (err: any) {
      console.error('Failed to fetch product reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const openReviewsModal = (prod: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReviewsModalProduct(prod);
    setShowReviewsModal(true);
    fetchProductReviews(prod.id, 1);
  };

  const handleToggleReviewApproval = async (reviewId: string, currentApproved: boolean) => {
    try {
      await api.patch(`/review/${reviewId}`, { approved: !currentApproved });
      setMessage(`Review status updated successfully.`);
      if (reviewsModalProduct) {
        fetchProductReviews(reviewsModalProduct.id, reviewsMeta.page);
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to update review status.');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    try {
      await api.delete(`/review/${reviewId}`);
      setMessage('Review deleted successfully.');
      if (reviewsModalProduct) {
        fetchProductReviews(reviewsModalProduct.id, reviewsMeta.page);
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to delete review.');
    }
  };


  const fetchCombos = async () => {

    try {
      const res: any = await api.get('/product-combos');
      setCombos(res.data?.data || res.data || []);
    } catch (err: any) {
      console.error('Failed to load combos');
    }
  };


  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (subTab === 'combos') {
      fetchCombos();
    } else {
      fetchProducts();
    }
  }, [subTab, search, categoryFilter, statusFilter]);

  const handleFetchProductFromLink = async () => {
    if (!pastedLink || !pastedLink.trim()) {
      setMessage("Please enter a valid product URL (e.g., Amazon link).");
      return;
    }
    setFetchingLink(true);
    setLinkFetchSuccess(null);
    setMessage(null);
    try {
      const res: any = await api.post('/products/parse-link', { url: pastedLink.trim() });
      const data = res.data?.data || res.data;

      if (data) {
        let matchedBrandId = productForm.brandId;
        if (data.brandName && brands.length > 0) {
          const foundBrand = brands.find((b: any) =>
            b.name.toLowerCase().includes(data.brandName.toLowerCase()) ||
            data.brandName.toLowerCase().includes(b.name.toLowerCase())
          );
          if (foundBrand) {
            matchedBrandId = foundBrand.id;
          }
        }

        setProductForm((prev: any) => ({
          ...prev,
          name: data.name || prev.name,
          description: data.description || prev.description,
          thumbnailImageUrl: data.thumbnailImageUrl || prev.thumbnailImageUrl,
          imageUrls: data.imageUrls && data.imageUrls.length > 0 ? data.imageUrls : prev.imageUrls,
          tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || prev.tags),
          attributes: Array.isArray(data.keySpecifications) ? data.keySpecifications.join(', ') : (data.attributes || prev.attributes),
          originCountry: data.originCountry || prev.originCountry || 'India',
          brandId: matchedBrandId,
          ingredients: data.ingredients || prev.ingredients,
          healthBenefits: data.healthBenefits || prev.healthBenefits,
          usageInstructions: data.usageInstructions || prev.usageInstructions,
          storageInstructions: data.storageInstructions || prev.storageInstructions,
        }));

        if (data.price && data.price > 0) {
          setDraftVariant((prev: any) => ({
            ...prev,
            price: data.price,
            discountPercentage: data.discountPercentage || prev.discountPercentage || 0,
          }));
        }

        // Auto-add default product variant if no variants exist yet
        if (!selectedProduct) {
          const targetSubCategoryId = await getOrCreateSubCategoryId(productForm.categoryId);

          if (targetSubCategoryId) {
            let matchedVar = globalVariants.find(
              (v: any) => v.name.toLowerCase() === 'standard' || v.name.toLowerCase() === 'default'
            );

            if (!matchedVar) {
              try {
                const res: any = await api.post('/variants', {
                  name: 'Standard',
                  description: 'Default single unit variant created dynamically',
                  subCategoryId: targetSubCategoryId
                });
                matchedVar = res.data || res;
                setGlobalVariants((prev: any) => [...prev, matchedVar]);
              } catch (varErr) {
                console.error('Failed to create default variant:', varErr);
              }
            }

            if (matchedVar) {
              const basePrice = data.originalPrice && data.originalPrice > data.price 
                ? Number(data.originalPrice) 
                : (data.price && data.price > 0 ? Number(data.price) : (draftVariant.price || 1000));

              const sellingPrice = data.price && data.price > 0 ? Number(data.price) : basePrice;

              const varDiscount = basePrice > sellingPrice 
                ? Math.round(((basePrice - sellingPrice) / basePrice) * 100)
                : (data.discountPercentage || 0);

              const weight = draftVariant.weightInGrams || 100;

              const autoVariant = {
                variantId: matchedVar.id,
                variantName: matchedVar.name,
                price: basePrice,
                sellingPrice: sellingPrice,
                discountPercentage: varDiscount,
                weightInGrams: Number(weight),
                mfgDate: draftVariant.mfgDate || new Date().toISOString().slice(0, 10),
                expiryDate: draftVariant.expiryDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().slice(0, 10),
                pricePerGram: Math.round(sellingPrice / Number(weight || 1))
              };

              setProductForm((prev: any) => ({
                ...prev,
                varients: [autoVariant]
              }));

              setDraftVariant((prev: any) => ({
                ...prev,
                variantName: 'Standard',
                price: basePrice,
                sellingPrice: sellingPrice,
                discountPercentage: varDiscount
              }));
            }
          }
        }

        setLinkFetchSuccess('✨ Product details & variant pre-filled from link! Review and edit any field below before saving.');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Failed to fetch product details from link";
      setMessage(`Link Auto-fill error: ${errMsg}`);
    } finally {
      setFetchingLink(false);
    }
  };

  const handleFileUpload = async (files: FileList | null, isThumbnail: boolean) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('directory', 'products');
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
        if (isThumbnail) {
          setProductForm((prev: any) => ({
            ...prev,
            thumbnailImageUrl: uploadedUrls[0]
          }));
        } else {
          setProductForm((prev: any) => ({
            ...prev,
            imageUrls: [...prev.imageUrls, ...uploadedUrls]
          }));
        }
        setMessage('Image uploaded successfully!');
      }
    } catch (err: any) {
      setMessage(`Image upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Validations
      if (!productForm.categoryId) {
        setMessage('Error: Category is required. Please select a category from the list.');
        setLoading(false);
        return;
      }

      if (!selectedProduct && (!productForm.varients || productForm.varients.length === 0)) {
        setMessage('Error: You must add at least one variant before creating a product.');
        setLoading(false);
        return;
      }

      if (!productForm.thumbnailImageUrl) {
        setMessage('Error: Thumbnail image is required.');
        setLoading(false);
        return;
      }

      // 2. Format fields
      const formattedTags = typeof productForm.tags === 'string'
        ? productForm.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : productForm.tags;

      const formattedAttributes = typeof productForm.attributes === 'string'
        ? productForm.attributes.split(',').map((t: string) => t.trim()).filter(Boolean)
        : productForm.attributes;

      const videoUrl = productForm.videoUrl && productForm.videoUrl.trim() !== ''
        ? productForm.videoUrl.trim()
        : undefined;

      const payload: any = {
        name: productForm.name,
        brandId: productForm.brandId,
        categoryId: productForm.categoryId,
        tags: formattedTags,
        hsnId: productForm.hsnId,
        originCountry: productForm.originCountry,
        description: productForm.description,
        ingredients: productForm.ingredients || '',
        healthBenefits: productForm.healthBenefits || '',
        usageInstructions: productForm.usageInstructions || '',
        storageInstructions: productForm.storageInstructions || '',
        certifications: productForm.certifications || [],
        thumbnailImageUrl: productForm.thumbnailImageUrl,
        imageUrls: productForm.imageUrls || [],
        videoUrl: videoUrl,
        attributes: formattedAttributes,
        active: productForm.active,
        isFlashDeal: productForm.isFlashDeal || false,
      };

      if (!selectedProduct) {
        // Create requires variants array conforming to variantSchema
        payload.varients = productForm.varients.map((v: any) => ({
          variantId: v.variantId,
          discountPercentage: Number(v.discountPercentage || 0),
          mfgDate: new Date(v.mfgDate).toISOString(),
          expiryDate: new Date(v.expiryDate).toISOString(),
          price: Number(v.price),
          pricePerGram: Number(v.pricePerGram || Math.round(Number(v.price) / Number(v.weightInGrams || 1))),
          weightInGrams: Number(v.weightInGrams),
        }));
      }

      if (!payload.brandId || payload.brandId.trim() === '') delete payload.brandId;
      if (!payload.hsnId || payload.hsnId.trim() === '') delete payload.hsnId;

      if (selectedProduct) {
        await api.patch(`/products/${selectedProduct.id}`, payload);
        setMessage('Product updated successfully!');
      } else {
        await api.post('/products', payload);
        setMessage('Product created successfully!');
      }
      setShowProductModal(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to save product';
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBasePriceChange = (val: number) => {
    const newBase = Math.max(0, val);
    const currentSell = draftVariant.sellingPrice !== undefined ? draftVariant.sellingPrice : newBase;
    let newDiscount = 0;
    
    if (newBase > 0 && currentSell <= newBase) {
      newDiscount = Math.round(((newBase - currentSell) / newBase) * 100);
    }

    setDraftVariant((prev: any) => ({
      ...prev,
      price: newBase,
      sellingPrice: currentSell,
      discountPercentage: newDiscount
    }));
  };

  const handleSellingPriceChange = (val: number) => {
    const newSell = Math.max(0, val);
    const currentBase = draftVariant.price || newSell;
    let newDiscount = 0;

    if (currentBase > 0 && newSell <= currentBase) {
      newDiscount = Math.round(((currentBase - newSell) / currentBase) * 100);
    }

    setDraftVariant((prev: any) => ({
      ...prev,
      price: currentBase,
      sellingPrice: newSell,
      discountPercentage: newDiscount
    }));
  };

  const handleDiscountChange = (val: number) => {
    const newDiscount = Math.max(0, Math.min(100, val));
    const currentBase = draftVariant.price || 0;
    let newSell = draftVariant.sellingPrice;

    if (currentBase > 0) {
      newSell = Math.round(currentBase * (1 - newDiscount / 100));
    }

    setDraftVariant((prev: any) => ({
      ...prev,
      discountPercentage: newDiscount,
      sellingPrice: newSell
    }));
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    const vName = (draftVariant.variantName || 'Standard').trim();

    const baseP = Number(draftVariant.price || 0);
    const sellP = Number(draftVariant.sellingPrice !== undefined ? draftVariant.sellingPrice : baseP);

    if (baseP <= 0) {
      alert("Validation Error: Base Price / MRP must be greater than 0.");
      return;
    }
    if (sellP <= 0) {
      alert("Validation Error: Final Selling Price must be greater than 0.");
      return;
    }
    if (sellP > baseP) {
      alert(`Validation Error: Final Selling Price (₹${sellP}) cannot be higher than Base Price / MRP (₹${baseP}).`);
      return;
    }
    if (Number(draftVariant.weightInGrams) <= 0) {
      alert("Validation Error: Weight must be greater than 0.");
      return;
    }

    setLoading(true);
    let targetSubCategoryId = await getOrCreateSubCategoryId(productForm.categoryId);

    if (!targetSubCategoryId) {
      alert("Error initializing product sub-category. Please select a category.");
      setLoading(false);
      return;
    }

    try {
      const computedDiscount = Math.round(((baseP - sellP) / baseP) * 100);

      // 1. Check if variant name already exists globally
      let matchedVar = globalVariants.find(
        (v: any) => v.name.trim().toLowerCase() === vName.toLowerCase()
      );

      // 2. If it does not exist, create it on the backend
      if (!matchedVar) {
        const res: any = await api.post('/variants', {
          name: vName,
          description: `Created dynamically from product uploader`,
          subCategoryId: targetSubCategoryId
        });
        matchedVar = res.data || res;
        setGlobalVariants((prev: any) => [...prev, matchedVar]);
      }

      const targetVariantId = matchedVar.id;
      const targetVariantName = matchedVar.name;

      if (selectedProduct) {
        // Edit mode: add variant inline via API
        await handleAddVariantInline(targetVariantId);
      } else {
        // Create mode: add to local state
        const calculatedPricePerGram = Math.round(sellP / Number(draftVariant.weightInGrams || 1));
        const newVar = {
          variantId: targetVariantId,
          variantName: targetVariantName,
          price: baseP,
          sellingPrice: sellP,
          discountPercentage: computedDiscount,
          weightInGrams: Number(draftVariant.weightInGrams),
          mfgDate: draftVariant.mfgDate,
          expiryDate: draftVariant.expiryDate,
          pricePerGram: calculatedPricePerGram
        };

        // Prevent duplicate variantId in local state
        if (productForm.varients.some((v: any) => v.variantId === targetVariantId)) {
          alert("This variant has already been added to the product.");
          return;
        }

        setProductForm((prev: any) => ({
          ...prev,
          varients: [...prev.varients, newVar]
        }));

        // Reset draft variant values
        setDraftVariant((prev: any) => ({
          ...prev,
          variantName: '',
          price: 1000,
          sellingPrice: 900,
          discountPercentage: 10,
          weightInGrams: 100
        }));
      }
    } catch (err: any) {
      alert("Failed to add variant: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariantInline = async (targetVariantId: string) => {
    if (!selectedProduct) return;
    setLoading(true);
    setMessage(null);
    try {
      const payload = {
        variantId: targetVariantId,
        discountPercentage: Number(draftVariant.discountPercentage || 0),
        mfgDate: new Date(draftVariant.mfgDate).toISOString(),
        expiryDate: new Date(draftVariant.expiryDate).toISOString(),
        price: Number(draftVariant.price),
        pricePerGram: Math.round(Number(draftVariant.price) / Number(draftVariant.weightInGrams || 1)),
        weightInGrams: Number(draftVariant.weightInGrams),
      };

      await api.post(`/products/${selectedProduct.id}/variants`, payload);
      setMessage('Variant mapped successfully!');
      
      // Refresh current product variants
      const res: any = await api.get(`/products/${selectedProduct.id}`);
      const updatedProduct = res.data || res;
      setSelectedProduct(updatedProduct);
      setProductForm((prev: any) => ({
        ...prev,
        varients: updatedProduct.varients || []
      }));
      fetchProducts();

      // Reset draft variant name only (keep dates/subCategoryId)
      setDraftVariant((prev: any) => ({
        ...prev,
        variantName: '',
        price: 1000,
        discountPercentage: 0,
        weightInGrams: 100
      }));
    } catch (err: any) {
      setMessage(`Failed to add variant: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVariant = (vId: string) => {
    if (selectedProduct) {
      // Edit mode: delete variant inline via API
      handleDeleteVariantInline(vId);
    } else {
      // Create mode: remove from local state
      setProductForm((prev: any) => ({
        ...prev,
        varients: prev.varients.filter((v: any) => v.variantId !== vId)
      }));
    }
  };

  const handleDeleteVariantInline = async (vId: string) => {
    if (!selectedProduct) return;
    setLoading(true);
    setMessage(null);
    try {
      await api.delete(`/products/${selectedProduct.id}/variants/${vId}`);
      setMessage('Variant deleted successfully!');
      
      // Refresh current product variants
      const res: any = await api.get(`/products/${selectedProduct.id}`);
      const updatedProduct = res.data || res;
      setSelectedProduct(updatedProduct);
      setProductForm((prev: any) => ({
        ...prev,
        varients: updatedProduct.varients || []
      }));
      fetchProducts();
    } catch (err: any) {
      setMessage(`Failed to delete variant: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        productId: comboForm.productId,
        name: comboForm.name,
        description: comboForm.description,
        imageUrl: comboForm.imageUrl,
        weightInGrams: Number(comboForm.weightInGrams),
        active: true,
        items: comboForm.productVariantIds.map((vid: string) => ({
          productVariantId: vid,
          quantity: 1
        })),
        prices: [{
          price: Number(comboForm.price),
          discountedPrice: Number(comboForm.price),
          active: true
        }]
      };

      await api.post('/product-combos', payload);
      setMessage('Bundle Combo created successfully!');
      setShowComboModal(false);
      fetchCombos();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };



  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Delete this product? All variants and combos linked will be deleted.')) return;
    try {
      await api.delete(`/products/${id}`);
      setMessage('Product deleted.');
      fetchProducts();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const openAddModal = () => {
    setSelectedProduct(null);
    setPastedLink('');
    setLinkFetchSuccess(null);
    setMessage(null);
    setProductForm({
      name: '', brandId: brands[0]?.id || '', hsnId: hsns[0]?.id || '', tags: '', originCountry: 'India',
      description: '', ingredients: '', healthBenefits: '', usageInstructions: '', storageInstructions: '',
      certifications: [], thumbnailImageUrl: '', imageUrls: [], attributes: '', active: true, isFlashDeal: false,
      videoUrl: '', varients: [], categoryId: ''
    });
    const firstSubCategory = categories?.[0]?.subCategories?.[0]?.id || '';
    setDraftVariant({
      variantId: '',
      variantName: '',
      subCategoryId: firstSubCategory,
      discountPercentage: 0,
      mfgDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().slice(0, 10),
      weightInGrams: 100,
      price: 1000
    });
    setShowProductModal(true);
  };

  const openEditModal = (prod: any) => {
    setSelectedProduct(prod);
    setPastedLink('');
    setLinkFetchSuccess(null);
    setProductForm({
      name: prod.name, brandId: prod.brandId, hsnId: prod.hsnId, tags: prod.tags?.join(', ') || '', originCountry: prod.originCountry,
      description: prod.description, ingredients: prod.ingredients || '', healthBenefits: prod.healthBenefits || '', 
      usageInstructions: prod.usageInstructions || '', storageInstructions: prod.storageInstructions || '',
      certifications: prod.certifications || [], thumbnailImageUrl: prod.thumbnailImageUrl, imageUrls: prod.imageUrls || [], 
      attributes: prod.attributes?.join(', ') || '', active: prod.active, isFlashDeal: prod.isFlashDeal || false,
      videoUrl: prod.videoUrl || '',
      varients: prod.varients || [],
      categoryId: prod.categoryId || ''
    });
    const firstSubCategory = categories?.[0]?.subCategories?.[0]?.id || '';
    setDraftVariant({
      variantId: '',
      variantName: '',
      subCategoryId: firstSubCategory,
      discountPercentage: 0,
      mfgDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().slice(0, 10),
      weightInGrams: 100,
      price: 1000
    });
    setShowProductModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="font-bold text-blue-900">Close</button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setSubTab('catalog')}
          className={`px-6 py-3 font-semibold text-xs border-b-2 tracking-wider uppercase transition-all ${
            subTab === 'catalog' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Catalog Products
        </button>
        <button 
          onClick={() => setSubTab('combos')}
          className={`px-6 py-3 font-semibold text-xs border-b-2 tracking-wider uppercase transition-all ${
            subTab === 'combos' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Promo Bundles
        </button>
        <button 
          onClick={() => setSubTab('categories')}
          className={`px-6 py-3 font-semibold text-xs border-b-2 tracking-wider uppercase transition-all ${
            subTab === 'categories' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Category Management
        </button>
      </div>

      {subTab === 'categories' ? (
        <CategoryManager categories={categories} fetchMetadata={fetchMetadata} />
      ) : subTab !== 'combos' ? (
        <div className="space-y-4">
          {/* Filters & Actions bar */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search catalog products..."
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary flex-1"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none"
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            <button 
              onClick={openAddModal}
              className="bg-primary hover:bg-primary-dark text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>

          {/* Catalog Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Thumbnail</th>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Analytics</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((prod) => (
                    <tr key={prod.id} onClick={() => { setSelectedProduct(prod); setShowDetailsModal(true); }} className="hover:bg-slate-50/40 cursor-pointer transition-all">
                      <td className="px-6 py-4">
                        <img 
                          src={prod.thumbnailImageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=80'} 
                          alt="" 
                          className="w-12 h-12 object-cover rounded-lg border"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800">{prod.name}</span>
                          {prod.isFlashDeal && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-extrabold shadow-sm">
                              <Zap className="w-3 h-3 text-amber-500 fill-amber-500 animate-bounce" />
                              Flash Deal
                            </span>
                          )}
                          {prod.featured && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-extrabold shadow-sm">
                              <Star className="w-3 h-3 text-blue-500 fill-blue-500" />
                              Featured
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{prod.id}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-semibold">
                        {prod.varients?.[0]?.variant?.subCategory?.category?.name || prod.brand?.name || 'Unassigned'}
                      </td>

                      {/* Analytics Column */}
                      <td className="px-6 py-4">
                        {prod._analytics ? (
                          <div className="flex flex-col gap-1.5">
                            {/* Best Seller Badge */}
                            {prod._analytics.isBestSeller && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-extrabold w-fit">
                                <Award className="w-3 h-3" />
                                Best Seller
                              </span>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {/* Orders */}
                              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600" title="Total Orders Placed">
                                <ShoppingCart className="w-3 h-3 text-emerald-500" />
                                {prod._analytics.orderCount}
                              </span>
                              {/* Page Views */}
                              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600" title="Product Page Views">
                                <Eye className="w-3 h-3 text-blue-400" />
                                {prod._analytics.visitCount}
                              </span>
                              {/* Avg Rating */}
                              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600" title={`Avg Rating (${prod._analytics.reviewCount} reviews)`}>
                                <Star className="w-3 h-3 text-amber-400" />
                                {prod._analytics.avgRating > 0 ? prod._analytics.avgRating.toFixed(1) : '—'}
                                <span className="text-slate-400 font-normal">({prod._analytics.reviewCount})</span>
                              </span>
                              {/* Return Requests */}
                              {prod._analytics.returnRequestCount > 0 && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600" title="Return Requests">
                                  <RotateCcw className="w-3 h-3" />
                                  {prod._analytics.returnRequestCount}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-medium italic">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                          prod.active 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${prod.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {prod.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          getProductTotalStock(prod) > 5 ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          getProductTotalStock(prod) > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {getProductTotalStock(prod)} units
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Combo Panel Header */}
          <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">Bundle Packs</h3>
              <p className="text-[10px] text-slate-400">Bundle catalog items together at discounted prices</p>
            </div>
            <button 
              onClick={() => {
                setComboForm({
                  name: '', description: '', imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200',
                  weightInGrams: 200, price: 1999, productVariantIds: [], productId: products[0]?.id || ''
                });
                setShowComboModal(true);
              }}
              className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Build Combo Bundle
            </button>
          </div>

          {/* Combos list cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {combos.map((combo) => (
              <div key={combo.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <img src={combo.imageUrl} alt="" className="w-full h-40 object-cover border-b" />
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm truncate">{combo.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{combo.description}</p>
                  </div>
                  <div className="flex justify-between items-center mt-6 pt-4 border-t">
                    <span className="font-extrabold text-primary text-sm">
                      ₹{combo.prices?.[0]?.price || combo.weightInGrams}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Active Promo</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1. Create/Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProductModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden z-10 flex flex-col p-6 animate-fade-in">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {selectedProduct ? 'Edit Catalog Product' : 'Add New Catalog Product'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {selectedProduct ? `Product ID: ${selectedProduct.id}` : 'Fill in the information below to list a new catalog item'}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowProductModal(false)} 
                className="p-1 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Uploading Progress Notification */}
            {uploading && (
              <div className="flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl mb-4 text-primary font-bold animate-pulse justify-center text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading file(s) to secure cloud storage...</span>
              </div>
            )}

            {/* Modal Content Scroll Area Form */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto pr-2 space-y-8 py-2 -mr-2 scrollbar-thin text-xs">
              
              {/* Auto-Fill from Amazon / Product Link */}
              <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-blue-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                    Auto-Fill Product Details from Link
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                    Amazon / E-Commerce Link
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Paste an Amazon or product webpage URL to automatically extract and pre-fill title, price, images, description, and specs!
                </p>
                <div className="flex gap-2 pt-1">
                  <div className="relative flex-1">
                    <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="url"
                      value={pastedLink}
                      onChange={(e) => setPastedLink(e.target.value)}
                      placeholder="e.g. https://www.amazon.in/dp/B0BDHWDR12"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchProductFromLink}
                    disabled={fetchingLink || !pastedLink.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
                  >
                    {fetchingLink ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Fetching Data...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        Fetch & Pre-fill
                      </>
                    )}
                  </button>
                </div>
                {linkFetchSuccess && (
                  <div className="flex items-center gap-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-semibold text-[11px] mt-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{linkFetchSuccess}</span>
                  </div>
                )}
              </div>

              {/* Section 1: Basic Information */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2 border-b pb-2 border-slate-100 uppercase tracking-wider">
                  <Info className="w-4 h-4 text-primary" />
                  1. Basic Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Product Title</label>
                    <input 
                      type="text" 
                      required 
                      value={productForm.name} 
                      onChange={(e) => setProductForm({...productForm, name: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all" 
                      placeholder="e.g. Apple iPhone 15 Pro Max"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Category (Mandatory)</label>
                    <select 
                      required
                      value={productForm.categoryId} 
                      onChange={(e) => setProductForm({...productForm, categoryId: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all font-bold text-slate-600"
                    >
                      <option value="">Select Category</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Brand Option</label>
                    <div className="flex gap-2">
                      <select 
                        value={productForm.brandId} 
                        onChange={(e) => setProductForm({...productForm, brandId: e.target.value})} 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all font-bold text-slate-600"
                      >
                        <option value="">Select Brand</option>
                        {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          const name = prompt("Enter new brand name:");
                          if (name && name.trim()) {
                            try {
                              setLoading(true);
                              const res: any = await api.post('/brands', { 
                                name: name.trim(), 
                                description: 'Created dynamically from product listing',
                                imageUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200'
                              });
                              const newBrand = res.data || res;
                              setBrands((prev) => [...prev, newBrand]);
                              setProductForm((prev: any) => ({ ...prev, brandId: newBrand.id }));
                              alert(`Brand "${name.trim()}" added successfully!`);
                            } catch (err: any) {
                              alert("Failed to create brand: " + err.message);
                            } finally {
                              setLoading(false);
                            }
                          }
                        }}
                        className="px-3 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1"
                        title="Create New Brand"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="hidden">
                    <label className="block text-slate-500 font-bold mb-1">HSN Config / GST</label>
                    <select 
                      value={productForm.hsnId} 
                      onChange={(e) => setProductForm({...productForm, hsnId: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all font-bold text-slate-600"
                    >
                      {hsns.map((h: any) => <option key={h.id} value={h.id}>{h.hsnCode} ({h.gstRate}%)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Origin Country</label>
                    <input 
                      type="text" 
                      required
                      value={productForm.originCountry} 
                      onChange={(e) => setProductForm({...productForm, originCountry: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all" 
                      placeholder="e.g. India"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Video URL (Optional)</label>
                    <input 
                      type="url" 
                      value={productForm.videoUrl} 
                      onChange={(e) => setProductForm({...productForm, videoUrl: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all" 
                      placeholder="e.g. https://youtube.com/..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Tags (separated by comma)</label>
                    <input 
                      type="text" 
                      placeholder="smartphone, premium, ios" 
                      value={productForm.tags} 
                      onChange={(e) => setProductForm({...productForm, tags: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all" 
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {productForm.tags && typeof productForm.tags === 'string' && productForm.tags.split(',').map((t: string) => t.trim()).filter(Boolean).map((tag: string, index: number) => (
                        <span key={index} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-semibold">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Key Specifications (separated by comma)</label>
                    <input 
                      type="text" 
                      placeholder="Titanium Design, A17 Pro Chip" 
                      value={productForm.attributes} 
                      onChange={(e) => setProductForm({...productForm, attributes: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all" 
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {productForm.attributes && typeof productForm.attributes === 'string' && productForm.attributes.split(',').map((a: string) => a.trim()).filter(Boolean).map((attr: string, index: number) => (
                        <span key={index} className="bg-blue-50 text-primary px-2 py-0.5 rounded-md text-[10px] font-semibold">{attr}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Flash Deal Toggle Switch */}
                <div className="flex items-center justify-between p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl mt-3">
                  <div>
                    <span className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500 animate-bounce" />
                      Mark as Flash Deal Product
                    </span>
                    <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                      Enable to feature this product in the store homepage Limited Stock & Flash Deals section.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!productForm.isFlashDeal}
                      onChange={(e) => setProductForm({ ...productForm, isFlashDeal: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>

              {/* Section 2: Media Upload */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2 border-b pb-2 border-slate-100 uppercase tracking-wider">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  2. Product Images & Media
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Thumbnail Section */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <label className="block text-slate-700 font-bold mb-1">Main Thumbnail Image (Required)</label>
                    {productForm.thumbnailImageUrl ? (
                      <div className="relative w-full aspect-square max-w-40 rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-end bg-white">
                        <img 
                          src={productForm.thumbnailImageUrl} 
                          alt="Thumbnail Preview" 
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end justify-between p-2.5">
                          <span className="text-[9px] font-bold text-white uppercase tracking-wider">Thumbnail</span>
                          <button 
                            type="button" 
                            onClick={() => setProductForm({...productForm, thumbnailImageUrl: ''})} 
                            className="p-1 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-sm transition-all"
                            title="Replace Thumbnail"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files, true); }}
                        onClick={() => document.getElementById('thumbnail-file-input')?.click()}
                        className="border-2 border-dashed border-slate-200 bg-white hover:border-primary hover:bg-slate-50/50 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group h-40"
                      >
                        <input 
                          id="thumbnail-file-input" 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileUpload(e.target.files, true)} 
                          className="hidden" 
                        />
                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 group-hover:text-primary transition-all text-slate-400">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 text-[11px]">Upload thumbnail</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Drag & drop or click</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Gallery Section */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <label className="block text-slate-700 font-bold mb-1">Secondary Gallery Images ({productForm.imageUrls?.length || 0})</label>
                    <div className="grid grid-cols-3 gap-2">
                      {productForm.imageUrls && productForm.imageUrls.map((url: string, index: number) => (
                        <div key={index} className="relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm group">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              const nextUrls = productForm.imageUrls.filter((_: any, i: number) => i !== index);
                              setProductForm({...productForm, imageUrls: nextUrls});
                            }}
                            className="absolute top-1 right-1 p-1 bg-slate-900/60 hover:bg-slate-900/80 text-white rounded-md transition-all shadow-sm opacity-0 group-hover:opacity-100"
                            title="Remove Image"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {/* Add Gallery Image Card */}
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files, false); }}
                        onClick={() => document.getElementById('gallery-file-input')?.click()}
                        className="aspect-square border-2 border-dashed border-slate-200 bg-white hover:border-primary hover:bg-slate-50/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all gap-1 text-center p-2 group"
                      >
                        <input 
                          id="gallery-file-input" 
                          type="file" 
                          multiple 
                          accept="image/*" 
                          onChange={(e) => handleFileUpload(e.target.files, false)} 
                          className="hidden" 
                        />
                        <Plus className="w-4 h-4 text-slate-400 group-hover:text-primary transition-all" />
                        <span className="font-bold text-slate-600 text-[9px] group-hover:text-primary transition-all">Add Images</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Description & Copywriting */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2 border-b pb-2 border-slate-100 uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-primary" />
                  3. Technical Specs & Descriptions
                </h4>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Short Description (Required)</label>
                  <textarea 
                    required 
                    value={productForm.description} 
                    onChange={(e) => setProductForm({...productForm, description: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all h-20 leading-relaxed" 
                    placeholder="Enter a brief, catchy summary of the product..."
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Technical Specs & Materials (Optional)</label>
                  <textarea 
                    value={productForm.ingredients} 
                    onChange={(e) => setProductForm({...productForm, ingredients: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all h-16 leading-relaxed" 
                    placeholder="e.g. ABS plastic shell, aluminum parts, copper core, rechargeable lithium battery..."
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Key Features & Highlights (Optional)</label>
                  <textarea 
                    value={productForm.healthBenefits} 
                    onChange={(e) => setProductForm({...productForm, healthBenefits: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all h-16 leading-relaxed" 
                    placeholder="e.g. Energy-saving LED, 3-speed control, portable travel size..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Operating Guide / Instructions (Optional)</label>
                    <textarea 
                      value={productForm.usageInstructions} 
                      onChange={(e) => setProductForm({...productForm, usageInstructions: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all h-16 leading-relaxed" 
                      placeholder="e.g. Press button once for low speed, twice for high speed..."
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Safety Warnings & Care (Optional)</label>
                    <textarea 
                      value={productForm.storageInstructions} 
                      onChange={(e) => setProductForm({...productForm, storageInstructions: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all h-16 leading-relaxed" 
                      placeholder="e.g. Keep away from water and fire, do not short-circuit..."
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Certifications */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2 border-b pb-2 border-slate-100 uppercase tracking-wider">
                  <Award className="w-4 h-4 text-primary" />
                  4. Certifications
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'VEGAN', label: 'CE Certified', desc: 'Conforms to EU safety standards' },
                    { id: 'ORGANIC_CERTIFIED', label: 'FCC Compliant', desc: 'Approved electronic emissions' },
                    { id: 'NON_GMO', label: 'RoHS Compliant', desc: 'Restriction of hazardous substances' },
                    { id: 'GLUTEN_FREE', label: 'UL Safety Listed', desc: 'Electrical safety standards certified' },
                    { id: 'CRUELTY_FREE', label: 'QC Passed', desc: '100% daily-use quality checked' },
                    { id: 'PARABEN_FREE', label: 'Eco-Friendly Pack', desc: 'Recyclable packaging materials' },
                  ].map((cert) => {
                    const isChecked = productForm.certifications?.includes(cert.id);
                    return (
                      <label 
                        key={cert.id} 
                        className={`flex items-start gap-2 p-3 border rounded-xl cursor-pointer transition-all hover:bg-slate-50/50 ${
                          isChecked 
                            ? 'border-primary bg-blue-50/10 text-primary font-bold' 
                            : 'border-slate-100 bg-white text-slate-600 shadow-sm'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            const current = productForm.certifications || [];
                            const next = current.includes(cert.id) ? current.filter((c: string) => c !== cert.id) : [...current, cert.id];
                            setProductForm({ ...productForm, certifications: next });
                          }}
                          className="rounded border-slate-300 text-primary focus:ring-primary w-3.5 h-3.5 mt-0.5"
                        />
                        <div>
                          <span className="text-[11px] font-bold block leading-tight">{cert.label}</span>
                          <span className="text-[9px] text-slate-400 font-normal leading-normal">{cert.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Section 5: Variants */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2 border-b pb-2 border-slate-100 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-primary" />
                  5. Product Pricing Variants
                </h4>
                
                {/* Current Variants list */}
                <div>
                  <h5 className="text-slate-600 font-bold mb-2">Current Active Variants ({productForm.varients?.length || 0})</h5>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/10 shadow-sm">
                    {productForm.varients && productForm.varients.length > 0 ? (
                      productForm.varients.map((item: any, index: number) => {
                        const vName = getVariantDisplayName(item);
                        const vId = item.variantId || item.variant?.id;
                        const basePrice = item.prices?.[0]?.price || item.price || 0;
                        return (
                          <div key={index} className="flex justify-between items-center p-3 bg-white text-xs">
                            <div>
                              <span className="font-bold text-slate-800">{vName}</span>
                              <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                                Weight: {item.weightInGrams}g | Discount: {item.discountPercentage}%
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <span className="font-extrabold text-slate-800 text-xs font-mono">₹{basePrice}</span>
                              </div>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleDeleteVariant(vId)}
                                className="p-1.5 bg-red-50 text-danger hover:bg-red-100 rounded-lg transition-all"
                                title="Delete Variant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-slate-400 text-xs bg-white">
                        No variants added yet. You must add at least one variant before creating this product.
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Variant card */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <h5 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-primary" />
                    Map New Variant Option
                  </h5>
                  
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Variant Name (Free Text)</label>
                    <input 
                      type="text" 
                      value={draftVariant.variantName || ''} 
                      onChange={(e) => setDraftVariant({...draftVariant, variantName: e.target.value})} 
                      placeholder="e.g. Standard, Red 128GB, Portable Pack"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold text-slate-700 focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1 text-[11px]">Base Price / MRP (₹)</label>
                      <input 
                        type="number" 
                        value={draftVariant.price || ''} 
                        onChange={(e) => handleBasePriceChange(Number(e.target.value))} 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary font-semibold text-slate-700" 
                        placeholder="e.g. 1499"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-bold mb-1 text-[11px]">Final / Selling Price (₹)</label>
                      <input 
                        type="number" 
                        value={draftVariant.sellingPrice !== undefined ? draftVariant.sellingPrice : ''} 
                        onChange={(e) => handleSellingPriceChange(Number(e.target.value))} 
                        className={`w-full bg-white border rounded-xl px-3 py-2 outline-none font-extrabold ${
                          draftVariant.sellingPrice > draftVariant.price ? 'border-red-400 bg-red-50/50 text-red-600' : 'border-slate-200 text-emerald-600 focus:border-primary'
                        }`} 
                        placeholder="e.g. 999"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-bold mb-1 text-[11px]">Discount (%)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={draftVariant.discountPercentage || 0} 
                          onChange={(e) => handleDiscountChange(Number(e.target.value))} 
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none font-bold text-slate-700 pr-10" 
                          placeholder="0"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-extrabold text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          OFF
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-500 font-bold mb-1 text-[11px]">Weight (Grams)</label>
                      <input 
                        type="number" 
                        value={draftVariant.weightInGrams || ''} 
                        onChange={(e) => setDraftVariant({...draftVariant, weightInGrams: Number(e.target.value)})} 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold text-slate-700" 
                        placeholder="e.g. 100"
                      />
                    </div>
                  </div>

                  {/* Real-time validation warning */}
                  {draftVariant.sellingPrice > draftVariant.price && (
                    <div className="flex items-center gap-1.5 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 font-bold text-[11px]">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>Validation Error: Final Selling Price (₹{draftVariant.sellingPrice}) cannot be higher than Base Price / MRP (₹{draftVariant.price}).</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Mfg Date / Release Date</label>
                      <input 
                        type="date" 
                        value={draftVariant.mfgDate} 
                        onChange={(e) => setDraftVariant({...draftVariant, mfgDate: e.target.value})} 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Expiry Date / Warranty Expiry</label>
                      <input 
                        type="date" 
                        value={draftVariant.expiryDate} 
                        onChange={(e) => setDraftVariant({...draftVariant, expiryDate: e.target.value})} 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" 
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button 
                      type="button" 
                      onClick={handleAddVariant} 
                      disabled={loading}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Adding...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>{selectedProduct ? 'Add & Map Variant Inline' : 'Add Variant Option'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons & Notification Banner */}
              <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-slate-100 bg-white sticky bottom-0 z-20">
                {message && (
                  <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm border ${
                    message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') ? (
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span>{message}</span>
                    </div>
                    <button type="button" onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm px-1">✕</button>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowProductModal(false)} 
                    className="px-5 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading || uploading} 
                    className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{selectedProduct ? 'Save Changes' : 'Create Product Catalog'}</span>
                    )}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 3. Build Combo Bundle Modal */}
      {showComboModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowComboModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg z-10 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Create Promo Combo Bundle</h3>
            <form onSubmit={handleSaveCombo} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Bundle Title</label>
                <input type="text" required value={comboForm.name} onChange={(e) => setComboForm({...comboForm, name: e.target.value})} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Anchor Product Link</label>
                <select value={comboForm.productId} onChange={(e) => setComboForm({...comboForm, productId: e.target.value})} className="w-full bg-slate-50 border rounded-xl px-3 py-2">
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Bundle Description</label>
                <textarea required value={comboForm.description} onChange={(e) => setComboForm({...comboForm, description: e.target.value})} className="w-full bg-slate-50 border rounded-xl px-3 py-2 h-14" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Bundle Price (₹)</label>
                  <input type="number" required value={comboForm.price} onChange={(e) => setComboForm({...comboForm, price: e.target.value})} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Banner Image Link</label>
                  <input type="text" value={comboForm.imageUrl} onChange={(e) => setComboForm({...comboForm, imageUrl: e.target.value})} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowComboModal(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-500">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-primary text-white font-bold rounded-xl">{loading ? 'Creating...' : 'Create Combo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Product Details Overview Modal */}
      {showDetailsModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDetailsModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10 p-6">
            <div className="flex justify-between items-start border-b pb-4 mb-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">{selectedProduct.name}</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Product ID: {selectedProduct.id}</p>
              </div>
              <span className={`inline-block px-3 py-1 border rounded-full text-xs font-bold ${
                selectedProduct.productStatus === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                selectedProduct.productStatus === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-warning border-amber-100'
              }`}>
                {selectedProduct.productStatus}
              </span>
            </div>

            {/* Quick Status & Promotion Toggles Bar */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Visibility & Promotional Toggles
                </h4>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Toggle live status flags for store display</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Active Toggle Switch */}
                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
                  <span className="text-[11px] font-bold text-slate-700">Catalog Active</span>
                  <input
                    type="checkbox"
                    checked={!!selectedProduct.active}
                    onChange={async () => {
                      const newActive = !selectedProduct.active;
                      setSelectedProduct({ ...selectedProduct, active: newActive });
                      setProducts((prev) => prev.map((p) => p.id === selectedProduct.id ? { ...p, active: newActive } : p));
                      await api.patch(`/products/${selectedProduct.id}`, { active: newActive });
                      setMessage(`Product active status set to ${newActive ? 'ACTIVE' : 'INACTIVE'}`);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500 relative"></div>
                </label>

                {/* Flash Deal Toggle Switch */}
                <label className="flex items-center gap-2 cursor-pointer bg-amber-50/60 px-3 py-1.5 rounded-xl border border-amber-200 shadow-sm hover:bg-amber-50 transition-all">
                  <Zap className={`w-3.5 h-3.5 ${selectedProduct.isFlashDeal ? 'text-amber-500 fill-amber-500 animate-bounce' : 'text-slate-400'}`} />
                  <span className="text-[11px] font-bold text-amber-900">Flash Deal ⚡</span>
                  <input
                    type="checkbox"
                    checked={!!selectedProduct.isFlashDeal}
                    onChange={async () => {
                      const newFlash = !selectedProduct.isFlashDeal;
                      setSelectedProduct({ ...selectedProduct, isFlashDeal: newFlash });
                      setProducts((prev) => prev.map((p) => p.id === selectedProduct.id ? { ...p, isFlashDeal: newFlash } : p));
                      await api.patch(`/products/${selectedProduct.id}`, { isFlashDeal: newFlash });
                      await fetchProducts();
                      setMessage(`Product Flash Deal set to ${newFlash ? 'ON ⚡ (Max 3 active)' : 'OFF'}`);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500 relative"></div>
                </label>

                {/* Featured Toggle Switch */}
                <label className="flex items-center gap-2 cursor-pointer bg-blue-50/60 px-3 py-1.5 rounded-xl border border-blue-200 shadow-sm hover:bg-blue-50 transition-all">
                  <Star className={`w-3.5 h-3.5 ${selectedProduct.featured ? 'text-blue-500 fill-blue-500' : 'text-slate-400'}`} />
                  <span className="text-[11px] font-bold text-blue-900">Featured ⭐</span>
                  <input
                    type="checkbox"
                    checked={!!selectedProduct.featured}
                    onChange={async () => {
                      const newFeatured = !selectedProduct.featured;
                      setSelectedProduct({ ...selectedProduct, featured: newFeatured });
                      setProducts((prev) => prev.map((p) => p.id === selectedProduct.id ? { ...p, featured: newFeatured } : p));
                      await api.patch(`/products/${selectedProduct.id}`, { featured: newFeatured });
                      setMessage(`Product Featured status set to ${newFeatured ? 'ON ⭐' : 'OFF'}`);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-500 relative"></div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Product Thumbnail Gallery */}
              <div className="md:col-span-1 space-y-3">
                <img 
                  src={selectedProduct.thumbnailImageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200'} 
                  alt={selectedProduct.name} 
                  className="w-full aspect-square object-cover rounded-xl border"
                />
                {selectedProduct.imageUrls && selectedProduct.imageUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-1">
                    {selectedProduct.imageUrls.map((img: string, idx: number) => (
                      <img key={idx} src={img} alt="" className="aspect-square object-cover rounded border" />
                    ))}
                  </div>
                )}
              </div>

              {/* Product General Info */}
              <div className="md:col-span-2 space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-700">Specifications & Details</h4>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">BRAND</span>
                      <span className="font-bold text-slate-800">{selectedProduct.brand?.name || 'Store Brand'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">ORIGIN COUNTRY</span>
                      <span className="font-bold text-slate-800">{selectedProduct.originCountry || 'India'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">HSN TAX CODE</span>
                      <span className="font-mono font-bold text-slate-800">{selectedProduct.hsn?.hsnCode || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">ATTRIBUTES (SPECS)</span>
                      <span className="font-bold text-slate-800">{selectedProduct.attributes || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-700">Description</h4>
                  <p className="text-slate-500 mt-1 leading-relaxed">{selectedProduct.description || 'No description available.'}</p>
                </div>
              </div>
            </div>

            {/* Extra Info Accordion Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6">
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-1">Technical Specs & Materials</h4>
                <p className="text-slate-500">{selectedProduct.ingredients || 'N/A'}</p>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-1">Key Features & Highlights</h4>
                <p className="text-slate-500">{selectedProduct.healthBenefits || 'N/A'}</p>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-1">Operating Instructions</h4>
                <p className="text-slate-500">{selectedProduct.usageInstructions || 'N/A'}</p>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-1">Safety Warnings & Care</h4>
                <p className="text-slate-500">{selectedProduct.storageInstructions || 'N/A'}</p>
              </div>
            </div>

            {/* Product Variants List */}
            <div className="space-y-3 mb-6">
              <h4 className="font-bold text-slate-700 text-xs">Active Pricing Variants ({selectedProduct.varients?.length || 0})</h4>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30">
                {selectedProduct.varients && selectedProduct.varients.length > 0 ? (
                  selectedProduct.varients.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center p-3.5 text-xs bg-white">
                      <div>
                        <span className="font-bold text-slate-800">{getVariantDisplayName(item)}</span>
                        <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                          Discount: {item.discountPercentage}% | Warranty / Validity: {item.mfgDate?.slice(0, 10)} to {item.expiryDate?.slice(0, 10)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-800 text-sm">₹{item.prices?.[0]?.price || 'N/A'}</span>
                        {item.discountPercentage > 0 && (
                          <span className="text-[9px] text-rose-500 block font-semibold">Special Offer</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs bg-white">
                    No active pricing variants linked to this product.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3 pt-5 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => { setShowDetailsModal(false); openStockModal(selectedProduct); }} 
                  className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Box className="w-4 h-4 text-blue-600" />
                  Edit Stock
                </button>

                <button 
                  type="button" 
                  onClick={() => { setShowDetailsModal(false); openReviewsModal(selectedProduct); }} 
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  Reviews
                </button>

                <button 
                  type="button" 
                  onClick={() => { setShowDetailsModal(false); openPriceModal(selectedProduct); }} 
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Tag className="w-4 h-4 text-amber-600" />
                  Price & Offers
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => { setShowDetailsModal(false); openEditModal(selectedProduct); }} 
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Edit className="w-4 h-4 text-emerald-600" />
                  Edit Product
                </button>

                <button 
                  type="button" 
                  onClick={() => { setShowDetailsModal(false); handleDeleteProduct(selectedProduct.id); }} 
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  Delete
                </button>

                <button 
                  type="button" 
                  onClick={() => setShowDetailsModal(false)} 
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Quick Stock Update Modal */}
      {showStockModal && stockModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowStockModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10 p-6">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <Box className="w-5 h-5 text-primary" />
                  Stock & Inventory Control
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{stockModalProduct.name}</p>
              </div>
              <button 
                onClick={() => setShowStockModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Instantly adjust available inventory quantities for store order fulfillment:
              </p>

              {message && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm border ${
                  message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') ? (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                    <span>{message}</span>
                  </div>
                  <button type="button" onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 font-extrabold text-xs">✕</button>
                </div>
              )}

              {stockModalProduct.varients && stockModalProduct.varients.length > 0 ? (
                stockModalProduct.varients.map((v: any) => {
                  const currentVal = stockInputs[v.id] ?? 0;
                  const vName = v.variantName || v.variant?.name || (v.weightInGrams ? `${v.weightInGrams}g` : 'Standard Variant');
                  return (
                    <div key={v.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">
                          {vName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          Price: ₹{v.prices?.[0]?.price || v.price || 'N/A'} | ID: {v.id.slice(-6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                          <button
                            type="button"
                            onClick={() => setStockInputs((prev) => ({ ...prev, [v.id]: Math.max(0, (prev[v.id] || 0) - 1) }))}
                            className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold text-sm"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={currentVal}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setStockInputs((prev) => ({ ...prev, [v.id]: val }));
                            }}
                            className="w-16 text-center text-xs font-extrabold text-slate-800 outline-none py-1 border-x border-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => setStockInputs((prev) => ({ ...prev, [v.id]: (prev[v.id] || 0) + 1 }))}
                            className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold text-sm"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={savingStock}
                          onClick={() => handleSaveVariantStock(v.id)}
                          className="bg-primary hover:bg-primary-dark text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all shadow-md flex items-center gap-1.5"
                        >
                          {savingStock ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                  No pricing variants attached to this product yet. Add a variant in product edit mode first.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 mt-6 border-t">
              <button
                type="button"
                onClick={() => setShowStockModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Close Stock Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Quick Price & Offer Modal */}
      {showPriceModal && priceModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPriceModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto z-10 p-6">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-amber-500" />
                  Prices & Promotional Offers
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{priceModalProduct.name}</p>
              </div>
              <button 
                onClick={() => setShowPriceModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <p className="text-xs text-slate-500">
                Update regular listing price and apply instant discount percentages for store promotions:
              </p>

              {priceModalProduct.varients && priceModalProduct.varients.length > 0 ? (
                priceModalProduct.varients.map((v: any) => {
                  const inputState = priceInputs[v.id] || { price: 0, discountPercentage: 0, finalPrice: 0 };
                  const regPrice = Number(inputState.price || 0);
                  const discountPct = Number(inputState.discountPercentage || 0);
                  const finalPrice = inputState.finalPrice !== undefined 
                    ? Number(inputState.finalPrice) 
                    : Math.round(regPrice * (1 - discountPct / 100));

                  return (
                    <div key={v.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                        <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-orange-500" />
                          {getVariantDisplayName(v)}
                        </span>
                        <div className="text-right">
                          {discountPct > 0 && regPrice > finalPrice && (
                            <span className="text-[11px] font-semibold text-slate-400 line-through mr-2">
                              ₹{regPrice}
                            </span>
                          )}
                          <span className="text-sm font-extrabold text-emerald-600">
                            ₹{finalPrice}
                          </span>
                          {discountPct > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-rose-100 text-rose-700 font-extrabold text-[10px] rounded-full">
                              {discountPct}% OFF
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* REGULAR PRICE (MRP) */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">REGULAR PRICE (₹)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={regPrice}
                              onChange={(e) => {
                                const newReg = Math.max(0, parseFloat(e.target.value) || 0);
                                const newFinal = Math.round(newReg * (1 - discountPct / 100));
                                setPriceInputs((prev) => ({
                                  ...prev,
                                  [v.id]: {
                                    ...prev[v.id],
                                    price: newReg,
                                    finalPrice: newFinal
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        </div>

                        {/* FINAL SELLING PRICE (Auto-calculates Discount %) */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">FINAL PRICE (₹)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={finalPrice}
                              onChange={(e) => {
                                const newFinal = Math.max(0, parseFloat(e.target.value) || 0);
                                let calculatedPct = 0;
                                if (regPrice > 0) {
                                  calculatedPct = Math.max(0, Math.min(100, Math.round(((regPrice - newFinal) / regPrice) * 100)));
                                }
                                setPriceInputs((prev) => ({
                                  ...prev,
                                  [v.id]: {
                                    ...prev[v.id],
                                    finalPrice: newFinal,
                                    discountPercentage: calculatedPct
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-emerald-200 rounded-xl pl-7 pr-3 py-2 text-xs font-extrabold text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        {/* DISCOUNT OFFER % (Auto-calculates Final Price) */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">DISCOUNT OFFER (%)</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={discountPct}
                              onChange={(e) => {
                                const newPct = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                const newFinal = Math.round(regPrice * (1 - newPct / 100));
                                setPriceInputs((prev) => ({
                                  ...prev,
                                  [v.id]: {
                                    ...prev[v.id],
                                    discountPercentage: newPct,
                                    finalPrice: newFinal
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary"
                            />
                            <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Percentage Preset Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 mr-1">Presets:</span>
                        {[0, 5, 10, 15, 20, 25, 30, 50].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              const newFinal = Math.round(regPrice * (1 - pct / 100));
                              setPriceInputs((prev) => ({
                                ...prev,
                                [v.id]: {
                                  ...prev[v.id],
                                  discountPercentage: pct,
                                  finalPrice: newFinal
                                }
                              }));
                            }}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all ${
                              discountPct === pct 
                                ? 'bg-amber-500 text-white shadow-sm' 
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {pct === 0 ? 'No Offer' : `${pct}%`}
                          </button>
                        ))}
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          disabled={savingPrice}
                          onClick={() => handleSaveVariantPriceAndOffer(v)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                        >
                          {savingPrice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Update Price & Offer
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                  No pricing variants attached to this product yet.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 mt-6 border-t">
              <button
                type="button"
                onClick={() => setShowPriceModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Reviews & Ratings Modal */}
      {showReviewsModal && reviewsModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowReviewsModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10 p-6 space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div className="flex items-center gap-3">
                {reviewsModalProduct.thumbnailImageUrl ? (
                  <img src={reviewsModalProduct.thumbnailImageUrl} alt={reviewsModalProduct.name} className="w-12 h-12 object-cover rounded-xl border" />
                ) : (
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">{reviewsModalProduct.name}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                    Customer Reviews Feed & Moderation
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowReviewsModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            {reviewsLoading ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                Fetching reviews...
              </div>
            ) : productReviews.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <Star className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="font-extrabold text-slate-700 text-xs">No Reviews Found</h4>
                <p className="text-[11px] text-slate-400">This product has not received any customer reviews yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {productReviews.map((rev) => (
                  <div key={rev.id} className="p-4 bg-slate-50/70 border border-slate-100 rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-xs text-slate-800">
                          {rev.createdBy?.user?.name || 'Verified Customer'}
                        </span>
                        <div className="flex items-center gap-1 text-amber-400 mt-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${star <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                            />
                          ))}
                          <span className="text-[10px] font-bold text-slate-500 ml-1">({rev.rating}/5)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Approval Toggle */}
                        <button
                          onClick={() => handleToggleReviewApproval(rev.id, rev.approved)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition ${
                            rev.approved 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                          }`}
                          title={rev.approved ? 'Click to Unapprove' : 'Click to Approve'}
                        >
                          {rev.approved ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-amber-600" />}
                          {rev.approved ? 'Approved' : 'Pending'}
                        </button>

                        {/* Delete Review */}
                        <button
                          onClick={() => handleDeleteReview(rev.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-normal bg-white p-2.5 rounded-lg border border-slate-100">
                      "{rev.message}"
                    </p>

                    <p className="text-[10px] text-slate-400 font-mono">
                      Posted: {new Date(rev.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}

                {/* Modal Pagination Bar */}
                {Math.ceil(reviewsMeta.total / reviewsMeta.limit) > 1 && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <button
                      disabled={reviewsMeta.page <= 1}
                      onClick={() => fetchProductReviews(reviewsModalProduct.id, reviewsMeta.page - 1)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold disabled:opacity-40 transition"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-slate-500 font-medium">
                      Page <strong>{reviewsMeta.page}</strong> of <strong>{Math.ceil(reviewsMeta.total / reviewsMeta.limit)}</strong>
                    </span>
                    <button
                      disabled={reviewsMeta.page >= Math.ceil(reviewsMeta.total / reviewsMeta.limit)}
                      onClick={() => fetchProductReviews(reviewsModalProduct.id, reviewsMeta.page + 1)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold disabled:opacity-40 transition"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowReviewsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};


