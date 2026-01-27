import { useState, useEffect, useMemo, useRef } from 'react';
import { Treemap, PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Plus, Minus, RefreshCw, TrendingUp, TrendingDown, DollarSign, Wallet, PieChart as PieChartIcon, Filter, Upload, Copy, CheckCircle, XCircle, X, Pencil, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

// --- 초기 데이터 (기본값) ---
const INITIAL_DATA = [
  { id: 1, account: '성원', category: '해외주식', assetClass: '주식', type: '레버리지ETF', role: '전술(고위험)', risk: '초고위험', name: 'Direxion Daily Semiconductor Bull 3X', ticker: 'SOXL', qty: 58, avgPrice: 40926, currentPrice: 90453 },
  { id: 2, account: '소영', category: '거래소', assetClass: '암호화폐', type: '암호화폐', role: '전술(고위험)', risk: '초고위험', name: '비트코인', ticker: 'BTC', qty: 0.0229346, avgPrice: 0, currentPrice: 132132978 }, 
  { id: 3, account: '성원', category: '국내(ISA)', assetClass: '대체', type: '원자재ETF', role: '헤지/대체', risk: '중위험', name: 'ACE KRX금현물', ticker: '411060.KS', qty: 66, avgPrice: 30215, currentPrice: 32875 },
  { id: 4, account: '성원', category: '국내(ISA)', assetClass: '채권', type: '채권ETF', role: '헤지/안정', risk: '중위험', name: 'ACE 미국30년국채액티브', ticker: '453850.KS', qty: 137, avgPrice: 7838, currentPrice: 7665 },
  { id: 5, account: '성원', category: '해외주식', assetClass: '주식', type: '개별주식', role: '위성(개별주)', risk: '고위험', name: '애플', ticker: 'AAPL', qty: 5, avgPrice: 273440, currentPrice: 364222 },
  { id: 6, account: '성원', category: '해외주식', assetClass: '주식', type: '개별주식', role: '위성(개별주)', risk: '고위험', name: 'ASML 홀딩(ADR)', ticker: 'ASML', qty: 9, avgPrice: 1071099, currentPrice: 2039666 },
  { id: 7, account: '성원', category: '해외주식', assetClass: '주식', type: '개별주식', role: '위성(개별주)', risk: '고위험', name: '알파벳 A', ticker: 'GOOGL', qty: 6, avgPrice: 393986, currentPrice: 481532 },
  { id: 8, account: '성원', category: '해외주식', assetClass: '주식', type: '개별주식', role: '위성(개별주)', risk: '고위험', name: '마이크론 테크놀로지', ticker: 'MU', qty: 23, avgPrice: 153187, currentPrice: 586846 },
  { id: 9, account: '성원', category: '해외주식', assetClass: '주식', type: '개별주식', role: '위성(개별주)', risk: '고위험', name: '엔비디아', ticker: 'NVDA', qty: 62, avgPrice: 180443, currentPrice: 275574 },
  { id: 10, account: '소영', category: '해외주식/ETF', assetClass: '대체', type: '원자재ETF', role: '헤지/대체', risk: '중위험', name: 'iShares Silver Trust (추정)', ticker: 'SLV', qty: 1, avgPrice: 978785, currentPrice: 1837086 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// --- 유틸리티 함수 ---
const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 4 }).format(value);
const parseCSVNumber = (val: any) => {
  if (!val) return 0;
  let cleanStr = String(val).replace(/"/g, '').replace(/,/g, '');
  if (cleanStr.endsWith('.')) cleanStr = cleanStr.slice(0, -1);
  return parseFloat(cleanStr) || 0;
};

// 위험 등급별 색상 뱃지
const RiskBadge = ({ level }: { level: string | undefined }) => {
  let colorClass = "bg-gray-100 text-gray-800";
  if (level?.includes("초고위험")) colorClass = "bg-red-100 text-red-800 border border-red-200";
  else if (level?.includes("고위험")) colorClass = "bg-orange-100 text-orange-800 border border-orange-200";
  else if (level?.includes("중위험")) colorClass = "bg-yellow-100 text-yellow-800 border border-yellow-200";
  else if (level?.includes("저위험")) colorClass = "bg-green-100 text-green-800 border border-green-200";

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${colorClass}`}>
      {level || "미분류"}
    </span>
  );
};

// --- 히트맵(트리맵) 커스텀 콘텐츠 (오류 수정됨) ---
const CustomTreemapContent = (props: any) => {
  // props에서 필요한 데이터 추출 (payload가 없을 수 있으므로 직접 destructuring 및 fallback 처리)
  const { x, y, width, height, name, returnRate } = props;

  // 수익률에 따른 색상 결정
  const rate = returnRate || 0; // returnRate가 없으면 0으로 처리
  
  let fillColor = '#e5e7eb'; // 기본 회색
  let textColor = '#1f2937'; // 기본 텍스트 (어두운 회색)

  if (rate > 0) {
    // 상승: 빨강 계열 (수익이 클수록 진하게)
    if (rate >= 50) { fillColor = '#ef4444'; textColor = '#ffffff'; } // strong red
    else if (rate >= 20) { fillColor = '#f87171'; textColor = '#ffffff'; }
    else if (rate >= 10) { fillColor = '#fca5a5'; textColor = '#1f2937'; }
    else { fillColor = '#fecaca'; textColor = '#1f2937'; }
  } else if (rate < 0) {
    // 하락: 초록 계열 (손실이 클수록 진하게)
    if (rate <= -20) { fillColor = '#16a34a'; textColor = '#ffffff'; } // strong green
    else if (rate <= -10) { fillColor = '#4ade80'; textColor = '#1f2937'; }
    else { fillColor = '#bbf7d0'; textColor = '#1f2937'; }
  }

  // 칸이 너무 작으면 텍스트 숨김
  const showText = width > 40 && height > 40;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: fillColor,
          stroke: '#fff',
          strokeWidth: 2,
          strokeOpacity: 1,
        }}
      />
      {showText && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" fill={textColor} fontSize={12} style={{ fontWeight: 'bold' }}>
          <tspan x={x + width / 2} dy="-0.6em">{name}</tspan>
          <tspan x={x + width / 2} dy="1.2em">{rate.toFixed(1)}%</tspan>
        </text>
      )}
    </g>
  );
};

export default function PortfolioDashboard() {
  // --- 상태 초기화 (LocalStorage 연동) ---
  const [portfolio, setPortfolio] = useState(() => {
    const savedData = localStorage.getItem('my_portfolio_data');
    if (savedData) {
      try {
        return JSON.parse(savedData);
      } catch (e) {
        console.error("데이터 로드 실패, 초기값 사용", e);
        return INITIAL_DATA;
      }
    }
    return INITIAL_DATA;
  });

  const [targetAsset, setTargetAsset] = useState(() => {
    const savedTarget = localStorage.getItem('my_target_asset');
    return savedTarget ? Number(savedTarget) : 650000000;
  });

  useEffect(() => {
    localStorage.setItem('my_portfolio_data', JSON.stringify(portfolio));
  }, [portfolio]);

  useEffect(() => {
    localStorage.setItem('my_target_asset', targetAsset.toString());
  }, [targetAsset]);

  const [isUpdating, setIsUpdating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [serverStatus, setServerStatus] = useState('unknown');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterAccount, setFilterAccount] = useState('ALL'); 
  const [filterAssetClass, setFilterAssetClass] = useState('ALL');
  const [filterRisk, setFilterRisk] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTargetInput, setTempTargetInput] = useState('');

  const [activeModal, setActiveModal] = useState<{ type: 'buy' | 'sell'; item: any } | null>(null);
  const [modalInputs, setModalInputs] = useState({ qty: '', price: '' });

  const [newItem, setNewItem] = useState({
    account: '성원',
    category: '해외주식',
    assetClass: '주식',
    type: '개별주식',
    risk: '고위험',
    name: '',
    ticker: '',
    qty: 0,
    avgPrice: 0,
    currentPrice: 0,
    role: '위성(개별주)',
  });

  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch('http://localhost:5000/health');
        if (res.ok) setServerStatus('connected');
        else setServerStatus('disconnected');
      } catch (e) {
        setServerStatus('disconnected');
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 10000); 
    return () => clearInterval(interval);
  }, []);

  // --- 계산 로직 ---
  const uniqueAssetClasses = useMemo(() => ['ALL', ...new Set(portfolio.map((p: any) => p.assetClass).filter(Boolean))] as string[], [portfolio]);
  const uniqueRisks = useMemo(() => ['ALL', ...new Set(portfolio.map((p: any) => p.risk).filter(Boolean))] as string[], [portfolio]);

  const filteredData = useMemo(() => {
    return portfolio.filter((item: any) => {
      const matchAccount = filterAccount === 'ALL' || item.account === filterAccount;
      const matchAsset = filterAssetClass === 'ALL' || item.assetClass === filterAssetClass;
      const matchRisk = filterRisk === 'ALL' || item.risk === filterRisk;
      return matchAccount && matchAsset && matchRisk;
    });
  }, [portfolio, filterAccount, filterAssetClass, filterRisk]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const summary = useMemo(() => {
    let totalInvested = 0;
    let totalValue = 0;

    filteredData.forEach((item: any) => {
      totalInvested += item.avgPrice * item.qty;
      totalValue += item.currentPrice * item.qty;
    });

    const totalPL = totalValue - totalInvested;
    const returnRate = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
    const valueRatio = totalInvested > 0 ? (totalValue / totalInvested) * 100 : 0;

    return { totalInvested, totalValue, totalPL, returnRate, valueRatio };
  }, [filteredData]);

  // 자산군별 비중 (파이차트용)
  const assetAllocation = useMemo(() => {
    const allocation: any = {};
    filteredData.forEach((item: any) => {
      const key = item.assetClass || '기타';
      if (!allocation[key]) allocation[key] = 0;
      allocation[key] += item.currentPrice * item.qty;
    });
    return Object.keys(allocation).map((key: string) => ({ name: key, value: allocation[key] }));
  }, [filteredData]);

  // 히트맵 데이터 (트리맵용)
  const treemapData = useMemo(() => {
    const items = filteredData
      .filter((item: any) => (item.currentPrice * item.qty) > 0)
      .map((item: any) => {
        const value = item.currentPrice * item.qty;
        const invested = item.avgPrice * item.qty;
        const returnRate = invested > 0 ? ((value - invested) / invested) * 100 : 0;
        return {
          name: item.ticker || item.name,
          size: value,
          returnRate: returnRate,
          tooltipName: item.name,
          tooltipVal: value,
        };
      })
      .sort((a: any, b: any) => b.size - a.size);
    return items;
  }, [filteredData]);

  const progressPercentage = Math.min((summary.totalValue / targetAsset) * 100, 100);

  // --- 핸들러 함수들 ---
  const updatePrices = async () => {
    setIsUpdating(true);
    const tickers = portfolio.map((item: any) => item.ticker);
    try {
      const response = await fetch('http://localhost:5000/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });
      if (!response.ok) throw new Error('서버 응답 오류');
      const priceData = await response.json();
      const updated = portfolio.map((item: any) => {
        if (priceData[item.ticker]) {
          return { ...item, currentPrice: priceData[item.ticker] };
        }
        return item;
      });
      setPortfolio(updated);
      setServerStatus('connected');
    } catch (error) {
      setServerStatus('disconnected');
    }
    setIsUpdating(false);
  };

  const handleCopyForNotion = () => {
    const notionData = portfolio.map((item: any) => ({
      "종목명": item.name,
      "티커": item.ticker,
      "위험등급": item.risk,
      "자산군": item.assetClass,
      "수량": item.qty,
      "평가금액": item.currentPrice * item.qty,
      "수익률": ((item.currentPrice - item.avgPrice) / item.avgPrice * 100).toFixed(2) + '%'
    }));
    navigator.clipboard.writeText(JSON.stringify(notionData, null, 2));
    alert('Notion용 전체 데이터가 복사되었습니다.');
  };

  const handleAddItem = (e: any) => {
    e.preventDefault();
    const newEntry = {
      ...newItem,
      id: Date.now(),
      qty: Number(newItem.qty),
      avgPrice: Number(newItem.avgPrice),
      currentPrice: Number(newItem.currentPrice || newItem.avgPrice),
    };
    setPortfolio([...portfolio, newEntry]);
    setShowAddForm(false);
    setNewItem({ ...newItem, name: '', ticker: '', qty: 0, avgPrice: 0 });
  };

  const handleBuyMore = (id: any, buyQty: any, buyPrice: any) => {
    const updated = portfolio.map((item: any) => {
      if (item.id === id) {
        const totalCost = (item.avgPrice * item.qty) + (buyPrice * buyQty);
        const newQty = item.qty + buyQty;
        const newAvgPrice = totalCost / newQty;
        return { ...item, qty: newQty, avgPrice: Math.round(newAvgPrice) };
      }
      return item;
    });
    setPortfolio(updated);
  };

  const handleSellItem = (id: any, sellQty: any) => {
    const updated = portfolio.map((item: any) => {
      if (item.id === id) {
        return { ...item, qty: item.qty - sellQty };
      }
      return item;
    }).filter((item: any) => item.qty > 0);
    setPortfolio(updated);
  };

  const handleResetData = () => {
    if (window.confirm("정말로 데이터를 초기화하시겠습니까?")) {
      localStorage.removeItem('my_portfolio_data');
      localStorage.removeItem('my_target_asset');
      setPortfolio(INITIAL_DATA);
      setTargetAsset(650000000);
      alert("데이터가 초기화되었습니다.");
    }
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event: any) => {
      const csvText = event.target?.result as string;
      const lines = csvText.split('\n');
      const newPortfolio = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (parts.length < 8) continue;
        const qty = parseCSVNumber(parts[8]);
        const investedTotal = parseCSVNumber(parts[9]);
        const currentTotal = parseCSVNumber(parts[10]);
        const avgPrice = qty > 0 ? investedTotal / qty : 0;
        const currentPrice = qty > 0 ? currentTotal / qty : 0;
        newPortfolio.push({
          id: Date.now() + i,
          account: parts[0].replace(/"/g, '').trim(),
          category: parts[1].replace(/"/g, '').trim(),
          assetClass: parts[2].replace(/"/g, '').trim(),
          type: parts[3].replace(/"/g, '').trim(),
          role: parts[4].replace(/"/g, '').trim(),
          risk: parts[5].replace(/"/g, '').trim(),
          name: parts[6].replace(/"/g, '').trim(),
          ticker: parts[7].replace(/"/g, '').trim(),
          qty: qty,
          avgPrice: Math.round(avgPrice),
          currentPrice: Math.round(currentPrice)
        });
      }
      if (newPortfolio.length > 0) {
        setPortfolio(newPortfolio);
        setCurrentPage(1);
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const startEditingTarget = () => {
    setTempTargetInput(targetAsset.toString());
    setIsEditingTarget(true);
  };
  const saveTargetAsset = () => {
    const val = parseFloat(tempTargetInput.replace(/,/g, ''));
    if (!isNaN(val) && val > 0) setTargetAsset(val);
    setIsEditingTarget(false);
  };

  const openBuyModal = (item: any) => {
    setModalInputs({ qty: '', price: item.currentPrice });
    setActiveModal({ type: 'buy', item });
  };
  const openSellModal = (item: any) => {
    setModalInputs({ qty: '', price: '' });
    setActiveModal({ type: 'sell', item });
  };
  const closeActiveModal = () => {
    setActiveModal(null);
    setModalInputs({ qty: '', price: '' });
  };
  const handleModalSubmit = (e: any) => {
    e.preventDefault();
    if (!activeModal) return;
    const qty = Number(modalInputs.qty);
    const price = Number(modalInputs.price);
    if (activeModal.type === 'buy') {
      if (qty > 0 && price > 0) handleBuyMore(activeModal.item.id, qty, price);
    } else if (activeModal.type === 'sell') {
      if (qty > 0) handleSellItem(activeModal.item.id, qty);
    }
    closeActiveModal();
  };

  // 툴팁 커스터마이징
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-gray-200 shadow-md rounded text-sm">
          <p className="font-bold mb-1">{data.tooltipName} ({data.name})</p>
          <p className="text-gray-600">평가액: {formatCurrency(data.size)}</p>
          <p className={data.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}>
            수익률: {data.returnRate ? data.returnRate.toFixed(2) : 0}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans relative">
      <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

      {/* --- 모달 --- */}
      {activeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-fade-in">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-bold text-gray-800">
                {activeModal.type === 'buy' ? '추가 매수 (물타기)' : '매도 (수량 줄이기)'}
              </h3>
              <button onClick={closeActiveModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">종목명</p>
                <div className="font-medium text-gray-900 bg-gray-50 p-2 rounded">
                  {activeModal.item.name} <span className="text-xs text-gray-500">({activeModal.item.ticker})</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {activeModal.type === 'buy' ? '추가 매수 수량' : '매도할 수량'}
                </label>
                <input type="number" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" value={modalInputs.qty} onChange={e => setModalInputs({...modalInputs, qty: e.target.value})} placeholder="0" autoFocus required />
                {activeModal.type === 'sell' && <p className="text-xs text-gray-500 mt-1">현재 보유: {formatNumber(activeModal.item.qty)}주</p>}
              </div>
              {activeModal.type === 'buy' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">매수 단가 (1주당)</label>
                  <input type="number" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" value={modalInputs.price} onChange={e => setModalInputs({...modalInputs, price: e.target.value})} placeholder="0" required />
                  <p className="text-xs text-gray-500 mt-1">현재가: {formatCurrency(activeModal.item.currentPrice)}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={closeActiveModal} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition">취소</button>
                <button type="submit" className={`px-4 py-2 text-white rounded transition shadow-sm ${activeModal.type === 'buy' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-500 hover:bg-red-600'}`}>{activeModal.type === 'buy' ? '매수 반영' : '매도 반영'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            투자 대시보드
            {serverStatus === 'connected' ? 
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 border border-green-200"><CheckCircle className="w-3 h-3"/> Python 연결됨</span> : 
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1 border border-gray-200"><XCircle className="w-3 h-3"/> Python 연결안됨</span>
            }
          </h1>
          <p className="text-sm text-gray-500">실시간 API 및 Notion 연동 지원</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"><Upload className="w-4 h-4" /> CSV</button>
          <button onClick={handleCopyForNotion} className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm" title="Notion용 데이터 복사"><Copy className="w-4 h-4" /> Notion</button>
          <button onClick={updatePrices} disabled={isUpdating} className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm text-sm ${isUpdating ? 'opacity-70' : ''}`}><RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />{isUpdating ? '갱신 중...' : '가격 업데이트'}</button>
          <button onClick={handleResetData} className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 text-sm" title="초기화"><RotateCcw className="w-4 h-4" /> 초기화</button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-sm text-gray-700 font-medium mr-2">
          <Filter className="w-4 h-4 text-gray-500" />
          필터 설정:
        </div>
        <select className="bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 min-w-[120px]" value={filterAccount} onChange={(e) => {setFilterAccount(e.target.value); setCurrentPage(1);}}>
          <option value="ALL">전체 계좌</option>
          <option value="성원">성원 계좌</option>
          <option value="소영">소영 계좌</option>
        </select>
        <select className="bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 min-w-[120px]" value={filterAssetClass} onChange={(e) => {setFilterAssetClass(e.target.value); setCurrentPage(1);}}>
          <option value="ALL">모든 자산군</option>
          {uniqueAssetClasses.filter((c: string) => c !== 'ALL').map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 min-w-[120px]" value={filterRisk} onChange={(e) => {setFilterRisk(e.target.value); setCurrentPage(1);}}>
          <option value="ALL">모든 위험등급</option>
          {uniqueRisks.filter((r: string) => r !== 'ALL').map((r: string) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="ml-auto text-xs text-gray-400">
          검색된 항목: {filteredData.length}건
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-500 text-sm font-medium">총 평가 금액</h3>
            <Wallet className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight break-words">{formatCurrency(summary.totalValue)}</p>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
              <span className="flex items-center gap-1">
                목표: {isEditingTarget ? (
                  <div className="flex items-center gap-1">
                    <input type="number" value={tempTargetInput} onChange={(e) => setTempTargetInput(e.target.value)} className="w-24 p-0.5 border rounded text-xs" autoFocus />
                    <button onClick={saveTargetAsset} className="text-green-600 font-bold px-1">✓</button>
                  </div>
                ) : (
                  <>
                    {formatNumber(targetAsset)}
                    <button onClick={startEditingTarget} className="hover:bg-gray-100 p-0.5 rounded text-gray-400 hover:text-blue-500 transition"><Pencil className="w-3 h-3"/></button>
                  </>
                )}
              </span>
              <span className="font-semibold text-blue-600">{progressPercentage.toFixed(1)}% 달성</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-500 text-sm font-medium">총 매입 금액</h3>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight break-words">{formatCurrency(summary.totalInvested)}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
           <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-500 text-sm font-medium">평가 손익</h3>
            {summary.totalPL >= 0 ? <TrendingUp className="w-5 h-5 text-red-500" /> : <TrendingDown className="w-5 h-5 text-blue-500" />}
          </div>
          <p className={`text-xl sm:text-2xl font-bold tracking-tight break-words ${summary.totalPL >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
            {summary.totalPL >= 0 ? '+' : ''}{formatCurrency(summary.totalPL)}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-500 text-sm font-medium">수익률</h3>
            <PieChartIcon className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex items-end gap-2">
            <p className={`text-xl sm:text-2xl font-bold tracking-tight ${summary.returnRate >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
              {summary.returnRate.toFixed(2)}%
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2 bg-gray-50 inline-block px-2 py-1 rounded">
            매입 대비: <span className="font-bold text-gray-800">{summary.valueRatio.toFixed(1)}%</span>
          </p>
        </div>
      </div>

      {/* Chart Section: Pie & Treemap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Left: Asset Allocation Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">자산군별 비중</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={assetAllocation} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius="40%" 
                  outerRadius="70%" 
                  paddingAngle={5} 
                  dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                >
                  {assetAllocation.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <RechartsTooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Portfolio Heatmap */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">보유 종목 현황 (히트맵)</h3>
          <div className="h-80 w-full">
            {treemapData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={<CustomTreemapContent />}
                >
                  <RechartsTooltip content={<CustomTooltip />} />
                </Treemap>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">데이터가 없습니다.</div>
            )}
          </div>
          <div className="mt-4 flex gap-4 text-xs text-gray-500 justify-center">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> 상승 ({'>'}0%)</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> 하락 ({'<'}0%)</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 rounded-sm"></div> 크기 = 비중</div>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">보유 종목 상세</h3>
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-1 text-sm bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-800">
            <Plus className="w-4 h-4" /> 종목 추가
          </button>
        </div>

        {/* Add Form (유지) */}
        {showAddForm && (
          <form onSubmit={handleAddItem} className="bg-gray-50 p-6 border-b border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">자산군 / 등급</label>
              <div className="flex gap-2">
                <select className="w-1/2 p-2 border rounded text-xs" value={newItem.assetClass} onChange={e => setNewItem({...newItem, assetClass: e.target.value})}>
                  <option value="주식">주식</option>
                  <option value="채권">채권</option>
                  <option value="암호화폐">암호화폐</option>
                  <option value="대체">대체</option>
                </select>
                <select className="w-1/2 p-2 border rounded text-xs" value={newItem.risk} onChange={e => setNewItem({...newItem, risk: e.target.value})}>
                  <option value="초고위험">초고위험</option>
                  <option value="고위험">고위험</option>
                  <option value="중위험">중위험</option>
                  <option value="저위험">저위험</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">종목명 (티커)</label>
              <div className="flex gap-2">
                <input type="text" placeholder="종목명" className="w-2/3 p-2 border rounded" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} required />
                <input type="text" placeholder="티커" className="w-1/3 p-2 border rounded" value={newItem.ticker} onChange={e => setNewItem({...newItem, ticker: e.target.value})} required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">수량 / 매수가</label>
              <div className="flex gap-2">
                <input type="number" placeholder="수량" className="w-1/2 p-2 border rounded" value={newItem.qty} onChange={e => setNewItem({...newItem, qty: Number(e.target.value) || 0})} required />
                <input type="number" placeholder="단가" className="w-1/2 p-2 border rounded" value={newItem.avgPrice} onChange={e => setNewItem({...newItem, avgPrice: Number(e.target.value) || 0})} required />
              </div>
            </div>
            <div className="flex items-end">
               <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded">추가</button>
            </div>
          </form>
        )}

        {/* Extended Table (유지) */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-2 py-3">자산군</th>
                <th className="px-2 py-3">위험등급</th>
                <th className="px-2 py-3">종목명 (티커)</th>
                <th className="px-2 py-3 text-right whitespace-nowrap">수량</th>
                <th className="px-2 py-3 text-right whitespace-nowrap">매수금액</th>
                <th className="px-2 py-3 text-right whitespace-nowrap">평가금액</th>
                <th className="px-2 py-3 text-right whitespace-nowrap">수익률</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((item: any) => {
                 const totalVal = item.currentPrice * item.qty;
                 const invested = item.avgPrice * item.qty;
                 const roi = invested > 0 ? ((totalVal - invested) / invested) * 100 : 0;
                 return (
                  <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-2 py-4 text-xs font-medium text-gray-600 whitespace-nowrap">{item.assetClass}</td>
                    <td className="px-2 py-4">
                      <RiskBadge level={item.risk} />
                    </td>
                    <td className="px-2 py-4 font-medium text-gray-900 min-w-[120px]">
                      <div className="truncate" title={item.name}>{item.name}</div>
                      <div className="text-xs text-gray-400">{item.ticker}</div>
                    </td>
                    <td className="px-2 py-4 text-right whitespace-nowrap">{formatNumber(item.qty)}</td>
                    <td className="px-2 py-4 text-right text-gray-600 text-xs whitespace-nowrap">{formatCurrency(invested)}</td>
                    <td className="px-2 py-4 text-right font-bold text-gray-900 whitespace-nowrap">{formatCurrency(totalVal)}</td>
                    <td className={`px-2 py-4 text-right font-medium whitespace-nowrap ${roi >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
                      {roi.toFixed(2)}%
                    </td>
                    <td className="px-2 py-4 text-center flex justify-center gap-1 whitespace-nowrap">
                      <button 
                        onClick={() => openBuyModal(item)} 
                        className="text-blue-600 hover:bg-blue-50 p-1.5 rounded border border-blue-200"
                        title="추가 매수"
                      >
                        <Plus className="w-3 h-3"/>
                      </button>
                      <button 
                        onClick={() => openSellModal(item)} 
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded border border-red-200"
                        title="매도"
                      >
                        <Minus className="w-3 h-3"/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer: Filtered Summary */}
            <tfoot className="bg-gray-100 font-semibold text-gray-900">
              <tr>
                <td colSpan={4} className="px-2 py-3 text-right border-t border-gray-200 text-xs sm:text-sm whitespace-nowrap">
                  {filterAssetClass !== 'ALL' || filterRisk !== 'ALL' || filterAccount !== 'ALL' ? '필터링 합계' : '총 합계'}
                </td>
                <td className="px-2 py-3 text-right border-t border-gray-200 text-xs sm:text-sm whitespace-nowrap">
                  {formatCurrency(summary.totalInvested)}
                </td>
                <td className="px-2 py-3 text-right border-t border-gray-200 text-blue-900 text-xs sm:text-sm whitespace-nowrap">
                  {formatCurrency(summary.totalValue)}
                </td>
                <td className="px-2 py-3 text-right border-t border-gray-200 text-xs sm:text-sm whitespace-nowrap">
                  <span className={summary.returnRate >= 0 ? 'text-red-600' : 'text-blue-600'}>
                    {summary.returnRate.toFixed(2)}%
                  </span>
                </td>
                <td className="border-t border-gray-200"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center p-4 border-t border-gray-100 gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}