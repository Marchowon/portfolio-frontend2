import { useState, useEffect, useMemo, useRef } from 'react';
import { Treemap, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, LabelList, BarChart } from 'recharts';
import { Plus, Minus, RefreshCw, TrendingUp, TrendingDown, DollarSign, Wallet, PieChart as PieChartIcon, Filter, Upload, X, Pencil, ChevronLeft, ChevronRight, RotateCcw, BarChart2, Coins, ArrowUp, ArrowDown, Target, Cloud, CloudOff } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, onSnapshot } from "firebase/firestore";

// --- 환경 변수 선언 (Vercel에서 주입) ---
declare global {
  var __firebase_config: string | undefined;
  var __app_id: string | undefined;
  var __initial_auth_token: string | undefined;
}

// --- Firebase 초기화 ---
// __firebase_config가 없는 환경(로컬 등)일 경우를 대비해 예외처리
let firebaseConfig: any = {};
let app: any;
let auth: any;
let db: any;
let appId = 'default-app-id';

try {
  if (typeof globalThis.__firebase_config !== 'undefined' && globalThis.__firebase_config) {
    firebaseConfig = JSON.parse(globalThis.__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  appId = typeof globalThis.__app_id !== 'undefined' && globalThis.__app_id ? globalThis.__app_id : 'default-app-id';
} catch (e) {
  console.error("Firebase Config Error:", e);
}

// --- 초기 데이터 (빈 값으로 시작) ---
const INITIAL_DATA: any[] = [];

// --- 코인 ID 매핑 (CoinGecko API용) ---
const COIN_ID_MAP: { [key: string]: string } = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'XRP': 'ripple',
  'SOL': 'solana',
  'DOGE': 'dogecoin',
  'ADA': 'cardano',
  'DOT': 'cardano',
  'AVAX': 'avalanche-2',
};

// --- 티커 데이터베이스 (자동완성용) ---
const TICKER_DB: { [key: string]: { name: string; assetClass: string; risk: string } } = {
  'AAPL': { name: '애플', assetClass: '주식', risk: '고위험' },
  'MSFT': { name: '마이크로소프트', assetClass: '주식', risk: '고위험' },
  'NVDA': { name: '엔비디아', assetClass: '주식', risk: '초고위험' },
  'TSLA': { name: '테슬라', assetClass: '주식', risk: '초고위험' },
  'GOOGL': { name: '알파벳 A', assetClass: '주식', risk: '고위험' },
  'AMZN': { name: '아마존', assetClass: '주식', risk: '고위험' },
  'NFLX': { name: '넷플릭스', assetClass: '주식', risk: '고위험' },
  'PLTR': { name: '팔란티어', assetClass: '주식', risk: '초고위험' },
  'COIN': { name: '코인베이스', assetClass: '주식', risk: '초고위험' },
  'SOXL': { name: 'SOXL (반도체 3X)', assetClass: '주식', risk: '초고위험' },
  'TQQQ': { name: 'TQQQ (나스닥 3X)', assetClass: '주식', risk: '초고위험' },
  'SCHD': { name: 'SCHD (배당성장)', assetClass: '주식', risk: '중위험' },
  'JEPI': { name: 'JEPI (커버드콜)', assetClass: '대체', risk: '중위험' },
  'O': { name: '리얼티 인컴', assetClass: '대체', risk: '중위험' },
  'BTC': { name: '비트코인', assetClass: '암호화폐', risk: '초고위험' },
  'ETH': { name: '이더리움', assetClass: '암호화폐', risk: '초고위험' },
  'XRP': { name: '리플', assetClass: '암호화폐', risk: '초고위험' },
  'SOL': { name: '솔라나', assetClass: '암호화폐', risk: '초고위험' },
  'DOGE': { name: '도지코인', assetClass: '암호화폐', risk: '초고위험' },
};

// 위험도 정렬 순서 정의
const RISK_ORDER: { [key: string]: number } = {
  '초고위험': 1,
  '고위험': 2,
  '중고위험': 3,
  '중위험': 4,
  '저위험': 5,
  '미분류': 99
};

// --- 유틸리티 함수 ---
const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 4 }).format(value);
const parseCSVNumber = (val: any) => {
  if (!val) return 0;
  let cleanStr = String(val).replace(/"/g, '').replace(/,/g, '');
  if (cleanStr.endsWith('.')) cleanStr = cleanStr.slice(0, -1);
  return parseFloat(cleanStr) || 0;
};

const getTodayString = () => new Date().toISOString().split('T')[0];

const getWeekString = (dateStr: string) => {
  const date = new Date(dateStr);
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime() + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  const week = Math.ceil((day + 1) / 7);
  return `${date.getFullYear()}-W${week}`;
};

const getMonthString = (dateStr: string) => dateStr.substring(0, 7);

// --- Sub-components ---

const RiskBadge = ({ level }: { level: string | undefined }) => {
  let colorClass = "bg-gray-100 text-gray-800";
  let emoji = "🤍";

  if (level?.includes("초고위험")) {
    colorClass = "bg-red-100 text-red-800 border border-red-200";
    emoji = "❤️";
  } else if (level?.includes("고위험")) {
    colorClass = "bg-orange-100 text-orange-800 border border-orange-200";
    emoji = "🧡";
  } else if (level?.includes("중위험")) {
    colorClass = "bg-yellow-100 text-yellow-800 border border-yellow-200";
    emoji = "💛";
  } else if (level?.includes("저위험")) {
    colorClass = "bg-green-100 text-green-800 border border-green-200";
    emoji = "💚";
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${colorClass}`}>
      {emoji} {level || "미분류"}
    </span>
  );
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs z-50">
        <p className="font-bold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="mb-1">
            {entry.name}: {entry.name.includes('수익률') || entry.name.includes('비중') ? `${entry.value}%` : `${formatCurrency(entry.value * 10000)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const ComparisonTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs z-50">
        <p className="font-bold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="mb-1">
            {entry.name}: {entry.value}% 
            {entry.name === '현재 비중' && entry.payload.value > 0 ? ` (${formatCurrency(entry.payload.value)})` : ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-2 border border-gray-200 shadow-md rounded text-sm font-sans z-50">
        <p className="font-bold mb-1">{data.tooltipName || data.name} ({data.name})</p>
        <p className="text-gray-600">평가액: {formatCurrency(data.size || data.value)}</p>
        {data.returnRate !== undefined && (
          <p className={data.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}>
            수익률: {data.returnRate ? data.returnRate.toFixed(2) : 0}%
          </p>
        )}
      </div>
    );
  }
  return null;
};

const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, returnRate } = props;
  const rate = returnRate || 0;
  
  let fillColor = '#e5e7eb';
  let textColor = '#1f2937';

  if (rate > 0) {
    if (rate >= 50) { fillColor = '#ef4444'; textColor = '#ffffff'; }
    else if (rate >= 20) { fillColor = '#f87171'; textColor = '#ffffff'; }
    else if (rate >= 10) { fillColor = '#fca5a5'; textColor = '#1f2937'; }
    else { fillColor = '#fecaca'; textColor = '#1f2937'; }
  } else if (rate < 0) {
    if (rate <= -20) { fillColor = '#16a34a'; textColor = '#ffffff'; }
    else if (rate <= -10) { fillColor = '#4ade80'; textColor = '#1f2937'; }
    else { fillColor = '#bbf7d0'; textColor = '#1f2937'; }
  }

  const showText = width > 30 && height > 30;
  const fontSize = Math.max(10, Math.min(width / 5, height / 4, 14));

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
        <foreignObject x={x} y={y} width={width} height={height} style={{ pointerEvents: 'none' }}>
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            color: textColor,
            fontSize: `${fontSize}px`,
            fontWeight: 'bold',
            fontFamily: 'NanumSquare, sans-serif',
            padding: '4px',
            boxSizing: 'border-box',
            overflow: 'hidden',
            lineHeight: '1.2'
          }}>
            <span style={{ 
              wordBreak: 'keep-all', 
              wordWrap: 'break-word', 
              marginBottom: '2px',
              maxHeight: '60%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2, 
              WebkitBoxOrient: 'vertical'
            }}>
              {name}
            </span>
            <span style={{ fontSize: '0.9em', opacity: 0.9 }}>
              {rate.toFixed(1)}%
            </span>
          </div>
        </foreignObject>
      )}
    </g>
  );
};

export default function PortfolioDashboard() {
  const [user, setUser] = useState<User | null>(null);
  
  // --- 상태 초기화 ---
  const [portfolio, setPortfolio] = useState<any[]>(INITIAL_DATA);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<any[]>([]);
  const [targetAsset, setTargetAsset] = useState(650000000);
  const [targetAssetRatios, setTargetAssetRatios] = useState<Record<string, number>>({ '주식': 60, '채권': 30, '암호화폐': 5, '대체': 5 });
  const [targetRiskRatios, setTargetRiskRatios] = useState<Record<string, number>>({ '초고위험': 20, '고위험': 40, '중위험': 30, '저위험': 10 });

  const [exchangeRate, setExchangeRate] = useState(1432);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'value', direction: 'desc' });
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterAccount, setFilterAccount] = useState('ALL'); 
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTargetInput, setTempTargetInput] = useState('');
  const [activeModal, setActiveModal] = useState<{ type: 'buy' | 'sell'; item: any } | null>(null);
  const [modalInputs, setModalInputs] = useState({ qty: '', price: '' });
  const [editingCell, setEditingCell] = useState<{ id: number; field: 'qty' | 'avgPrice' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const [newItem, setNewItem] = useState({
    account: '성원',
    category: '해외주식',
    assetClass: '주식',
    type: '개별주식',
    risk: '고위험',
    name: '',
    ticker: '',
    qty: '',
    avgPrice: '',
    currentPrice: '',
    role: '위성(개별주)',
  });

  // --- 1. Firebase Auth ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!auth) return;
        if (typeof globalThis.__initial_auth_token !== 'undefined' && globalThis.__initial_auth_token) {
          await signInWithCustomToken(auth, globalThis.__initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Failed:", error);
      }
    };
    initAuth();
    const unsubscribe = auth ? onAuthStateChanged(auth, setUser) : () => {};
    return () => unsubscribe();
  }, []);

  // --- 2. Firebase Data Sync (Read) ---
  useEffect(() => {
    if (!user || !db) return;

    // 포트폴리오 데이터 구독
    const unsubPortfolio = onSnapshot(
      collection(db, 'artifacts', appId, 'users', user.uid, 'portfolio'),
      (snapshot: any) => {
        const items: any[] = [];
        snapshot.forEach((docItem: any) => items.push(docItem.data()));
        if (items.length > 0) setPortfolio(items);
        else if (!snapshot.metadata.hasPendingWrites) setPortfolio([]); // 서버 데이터가 없으면 빈 배열
      },
      (error: any) => console.error("Portfolio sync error:", error)
    );

    // 기타 설정 데이터 구독
    const unsubSettings = onSnapshot(
      doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'),
      (docItem: any) => {
        if (docItem.exists()) {
          const data = docItem.data();
          if (data.targetAsset) setTargetAsset(data.targetAsset);
          if (data.targetAssetRatios) setTargetAssetRatios(data.targetAssetRatios);
          if (data.targetRiskRatios) setTargetRiskRatios(data.targetRiskRatios);
          if (data.transactions) setTransactions(data.transactions);
          if (data.performanceHistory) setPerformanceHistory(data.performanceHistory);
        }
      },
      (error: any) => console.error("Settings sync error:", error)
    );

    return () => {
      unsubPortfolio();
      unsubSettings();
    };
  }, [user]);

  // --- 3. Firebase Helper Function (Write) ---
  const savePortfolioToFirebase = async (newPortfolio: any[]) => {
    if (!user || !db) {
      alert("로그인이 필요합니다. (자동 로그인 중...)");
      return;
    }

    try {
      console.log("Saving portfolio to Firebase...", newPortfolio.length, "items");
      const batchPromises = newPortfolio.map(item =>
        setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'portfolio', String(item.id)), item)
      );
      await Promise.all(batchPromises);
      console.log("Portfolio saved successfully!");
    } catch (error) {
      console.error("Error saving portfolio:", error);
      alert("데이터 저장 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    }
  };

  const saveSettingsToFirebase = async (data: any) => {
    if (!user || !db) return;
    try {
      console.log("Saving settings to Firebase...");
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), data, { merge: true });
    } catch (error) {
       console.error("Error saving settings:", error);
    }
  };

  // --- 실시간 환율 및 가격 API (코인) ---
  const fetchMarketData = async () => {
    setIsUpdating(true);
    try {
      // 1. 환율
      const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
      const rateData = await rateRes.json();
      const currentRate = rateData?.rates?.KRW ? Math.round(rateData.rates.KRW) : 1432;
      setExchangeRate(currentRate);

      // 2. 코인 가격 (CoinGecko)
      const coinIds = Object.values(COIN_ID_MAP).join(',');
      const coinRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=krw`);
      const coinData = await coinRes.json();

      // 포트폴리오 업데이트
      setPortfolio(currentPortfolio => {
        return currentPortfolio.map((item: any) => {
          const coinKey = COIN_ID_MAP[item.ticker];
          if (coinKey && coinData[coinKey] && coinData[coinKey].krw) {
            return { ...item, currentPrice: Math.round(coinData[coinKey].krw) };
          }
          
          const fluctuation = 1 + (Math.random() * 0.04 - 0.02);
          const finalPrice = Math.round(item.currentPrice * fluctuation); 
          return { ...item, currentPrice: finalPrice > 0 ? finalPrice : item.avgPrice };
        });
      });
    } catch (e) {
      console.error("Market data fetch failed:", e);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60 * 1000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { if (editingCell && editInputRef.current) editInputRef.current.focus(); }, [editingCell]);

  // --- 계산 로직 ---
  const filteredData = useMemo(() => {
    let result = portfolio;
    if (filterAccount === 'ALL') {
      const aggregated: Record<string, any> = {};
      result.forEach((item: any) => {
        const key = item.ticker || item.name;
        if (!aggregated[key]) {
          aggregated[key] = { ...item };
        } else {
          const totalQty = aggregated[key].qty + item.qty;
          const totalInvested = (aggregated[key].avgPrice * aggregated[key].qty) + (item.avgPrice * item.qty);
          const newAvgPrice = totalQty > 0 ? totalInvested / totalQty : 0;
          aggregated[key].qty = totalQty;
          aggregated[key].avgPrice = Math.round(newAvgPrice);
        }
      });
      return Object.values(aggregated);
    } else {
      return result.filter((item: any) => item.account === filterAccount);
    }
  }, [portfolio, filterAccount]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aValue: number = 0;
        let bValue: number = 0;
        if (sortConfig.key === 'risk') {
          const riskOrder: { [key: string]: number } = RISK_ORDER;
          aValue = riskOrder[a.risk || '미분류'] || 99;
          bValue = riskOrder[b.risk || '미분류'] || 99;
        } else if (sortConfig.key === 'invested') {
          aValue = a.avgPrice * a.qty;
          bValue = b.avgPrice * b.qty;
        } else if (sortConfig.key === 'value') {
          aValue = a.currentPrice * a.qty;
          bValue = b.currentPrice * b.qty;
        } else if (sortConfig.key === 'returnRate') {
          const aInvested = a.avgPrice * a.qty;
          const bInvested = b.avgPrice * b.qty;
          aValue = aInvested > 0 ? ((a.currentPrice * a.qty - aInvested) / aInvested) : -Infinity;
          bValue = bInvested > 0 ? ((b.currentPrice * b.qty - bInvested) / bInvested) : -Infinity;
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

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

  const progressPercentage = Math.min((summary.totalValue / targetAsset) * 100, 100);

  const subSummary = useMemo(() => {
    const stats: Record<string, { invested: number; value: number }> = {
      '나스닥': { invested: 0, value: 0 },
      '코스피': { invested: 0, value: 0 },
      '암호화폐': { invested: 0, value: 0 },
      '기타': { invested: 0, value: 0 },
    };
    filteredData.forEach((item: any) => {
      let key = '기타';
      if (item.assetClass === '암호화폐') key = '암호화폐';
      else if (item.category.includes('해외')) key = '나스닥';
      else if (item.category.includes('국내')) key = '코스피';
      stats[key].invested += item.avgPrice * item.qty;
      stats[key].value += item.currentPrice * item.qty;
    });
    return Object.entries(stats).map(([key, { invested, value }]) => {
      const pl = value - invested;
      const returnRate = invested > 0 ? (pl / invested) * 100 : 0;
      return { key, invested, value, pl, returnRate };
    }).filter(item => item.invested > 0 || item.value > 0);
  }, [filteredData]);

  useEffect(() => {
    const today = getTodayString();
    setPerformanceHistory((prev: any[]) => {
      const exists = prev.find((p: any) => p.date === today);
      const newEntry = { date: today, returnRate: parseFloat(summary.returnRate.toFixed(2)) };
      let newHistory = prev;
      if (exists) newHistory = prev.map((p: any) => p.date === today ? newEntry : p);
      else newHistory = [...prev, newEntry];
      return newHistory;
    });
  }, [summary.returnRate]);

  const composedChartData = useMemo(() => {
    const groupedData: { [key: string]: { buy: number, sell: number, returnRate: number } } = {};
    const filteredTx = filterAccount === 'ALL' ? transactions : transactions.filter((t: any) => t.account === filterAccount);
    filteredTx.forEach((tx: any) => {
      let key = tx.date;
      if (chartPeriod === 'weekly') key = getWeekString(tx.date);
      else if (chartPeriod === 'monthly') key = getMonthString(tx.date);
      if (!groupedData[key]) groupedData[key] = { buy: 0, sell: 0, returnRate: 0 };
      if (tx.type === 'buy') groupedData[key].buy += tx.amount;
      else if (tx.type === 'sell') groupedData[key].sell += tx.amount;
    });
    performanceHistory.forEach((h: any) => {
      let key = h.date;
      if (chartPeriod === 'weekly') key = getWeekString(h.date);
      else if (chartPeriod === 'monthly') key = getMonthString(h.date);
      if (groupedData[key]) groupedData[key].returnRate = h.returnRate;
    });
    return Object.keys(groupedData).map(key => ({
      name: key,
      buy: Math.round(groupedData[key].buy / 10000),
      sell: Math.round(groupedData[key].sell / 10000),
      returnRate: groupedData[key].returnRate
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions, performanceHistory, chartPeriod, filterAccount]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage]);

  const assetAllocationData = useMemo(() => {
    const allocation: Record<string, number> = {};
    filteredData.forEach((item: any) => {
      const key = item.assetClass || '기타';
      if (!allocation[key]) allocation[key] = 0;
      allocation[key] += item.currentPrice * item.qty;
    });
    const allKeys = Array.from(new Set([...Object.keys(allocation), ...Object.keys(targetAssetRatios)]));
    const totalVal = filteredData.reduce((acc, item) => acc + (item.currentPrice * item.qty), 0);
    return allKeys.map(key => {
      const currentVal = allocation[key] || 0;
      const currentPct = totalVal > 0 ? (currentVal / totalVal) * 100 : 0;
      return {
        name: key,
        current: parseFloat(currentPct.toFixed(1)),
        target: parseFloat((targetAssetRatios[key] || 0).toString()),
        value: currentVal 
      };
    }).sort((a, b) => b.current - a.current);
  }, [filteredData, targetAssetRatios]);

  const riskAllocationData = useMemo(() => {
    const allocation: Record<string, number> = {};
    filteredData.forEach((item: any) => {
      const key = item.risk || '미분류';
      if (!allocation[key]) allocation[key] = 0;
      allocation[key] += item.currentPrice * item.qty;
    });
    const allKeys = Array.from(new Set([...Object.keys(allocation), ...Object.keys(targetRiskRatios)]));
    const totalVal = filteredData.reduce((acc, item) => acc + (item.currentPrice * item.qty), 0);
    return allKeys.map(key => {
      const currentVal = allocation[key] || 0;
      const currentPct = totalVal > 0 ? (currentVal / totalVal) * 100 : 0;
      return {
        name: key,
        current: parseFloat(currentPct.toFixed(1)),
        target: parseFloat((targetRiskRatios[key] || 0).toString()),
        value: currentVal
      };
    }).sort((a, b) => {
        const rankA = RISK_ORDER[a.name] || 99;
        const rankB = RISK_ORDER[b.name] || 99;
        return rankA - rankB;
    });
  }, [filteredData, targetRiskRatios]);

  const treemapData = useMemo(() => {
    const items = filteredData
      .filter((item: any) => (item.currentPrice * item.qty) > 0)
      .map((item: any) => {
        const value = item.currentPrice * item.qty;
        const invested = item.avgPrice * item.qty;
        const returnRate = invested > 0 ? ((value - invested) / invested) * 100 : 0;
        return {
          name: item.name || item.ticker,
          size: value,
          returnRate: returnRate,
        };
      })
      .sort((a: any, b: any) => b.size - a.size);
    return items;
  }, [filteredData]);

  // --- Handlers ---
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const getSortButtonClass = (key: string) => {
    const isActive = sortConfig.key === key;
    return `px-2 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap ${isActive ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`;
  };

  const updatePrices = async () => {
    setIsUpdating(true);
    await fetchMarketData();
  };

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ticker = e.target.value.toUpperCase();
    let updates: any = { ticker };
    if (TICKER_DB[ticker]) {
      const info = TICKER_DB[ticker];
      updates = { ...updates, name: info.name, assetClass: info.assetClass, risk: info.risk };
    }
    setNewItem(prev => ({ ...prev, ...updates }));
  };

  const handleAddItem = (e: any) => {
    e.preventDefault();
    const today = getTodayString();
    const qty = Number(newItem.qty);
    const avgPrice = Number(newItem.avgPrice);
    const newEntry = {
      ...newItem,
      id: Date.now(),
      date: today,
      qty,
      avgPrice,
      currentPrice: Number(newItem.currentPrice || newItem.avgPrice),
    };
    
    const newPortfolio = [...portfolio, newEntry];
    setPortfolio(newPortfolio);
    const newTx = [...transactions, { date: today, type: 'buy', amount: qty * avgPrice, account: newItem.account }];
    setTransactions(newTx);

    // DB 저장
    savePortfolioToFirebase(newPortfolio);
    saveSettingsToFirebase({ transactions: newTx });

    setShowAddForm(false);
    setNewItem({ ...newItem, name: '', ticker: '', qty: '', avgPrice: '' });
  };

  const handleResetData = async () => {
    if (window.confirm("정말로 데이터를 초기화하시겠습니까? (서버 데이터는 유지될 수 있습니다)")) {
      setPortfolio([]);
      setTransactions([]);
      setPerformanceHistory([]);
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
      const newPortfolio: any[] = [];
      const newTx: any[] = [];
      const today = getTodayString();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (parts.length < 8) continue;
        const qty = parseCSVNumber(parts[8]);
        const investedTotal = parseCSVNumber(parts[9]);
        const avgPrice = parseCSVNumber(parts[9]) > 0 && qty > 0 ? parseCSVNumber(parts[9]) / qty : 0;
        const currentPrice = parseCSVNumber(parts[10]) > 0 && qty > 0 ? parseCSVNumber(parts[10]) / qty : 0;
        const account = parts[0].replace(/"/g, '').trim();

        newPortfolio.push({
          id: Date.now() + i,
          date: today,
          account,
          category: parts[1].replace(/"/g, '').trim(),
          assetClass: parts[2].replace(/"/g, '').trim(),
          type: parts[3].replace(/"/g, '').trim(),
          role: parts[4].replace(/"/g, '').trim(),
          risk: parts[5].replace(/"/g, '').trim(),
          name: parts[6].replace(/"/g, '').trim(),
          ticker: parts[7].replace(/"/g, '').trim(),
          qty,
          avgPrice: Math.round(avgPrice),
          currentPrice: Math.round(currentPrice)
        });

        newTx.push({
          date: today,
          type: 'buy',
          amount: investedTotal,
          account
        });
      }
      if (newPortfolio.length > 0) {
        setPortfolio(newPortfolio);
        setTransactions(prev => {
           const updatedTransactions = [...prev, ...newTx];
           savePortfolioToFirebase(newPortfolio);
           saveSettingsToFirebase({ transactions: updatedTransactions })
             .then(() => alert("CSV 데이터가 Firebase에 성공적으로 동기화되었습니다!"))
             .catch((err) => console.error("Firebase sync failed:", err));
           return updatedTransactions;
        });
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
    if (!isNaN(val) && val > 0) {
      setTargetAsset(val);
      saveSettingsToFirebase({ targetAsset: val });
    }
    setIsEditingTarget(false);
  };

  const handleStartEdit = (item: any, field: 'qty' | 'avgPrice') => {
    setEditingCell({ id: item.id, field });
    if (field === 'qty') setEditValue(String(item.qty));
    else setEditValue(String(item.avgPrice));
  };

  const handleSaveEdit = () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue < 0) {
      setEditingCell(null);
      return;
    }
    const updatedPortfolio = portfolio.map(item => {
      if (item.id === id) {
        if (field === 'qty') return { ...item, qty: newValue };
        else if (field === 'avgPrice') return { ...item, avgPrice: newValue };
      }
      return item;
    });
    setPortfolio(updatedPortfolio);
    savePortfolioToFirebase(updatedPortfolio);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const openBuyModal = (item: any) => {
    setModalInputs({ qty: '', price: String(item.currentPrice) });
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

  const handleBuyMore = (id: any, buyQty: number, buyPrice: number) => {
    const today = getTodayString();
    let updatedTransactions = [...transactions];
    const updatedPortfolio = portfolio.map(item => {
      if (item.id === id) {
        const totalCost = (item.avgPrice * item.qty) + (buyPrice * buyQty);
        const newQty = item.qty + buyQty;
        const newAvgPrice = totalCost / newQty;
        updatedTransactions.push({ date: today, type: 'buy', amount: buyPrice * buyQty, account: item.account });
        return { ...item, qty: newQty, avgPrice: Math.round(newAvgPrice) };
      }
      return item;
    });

    setPortfolio(updatedPortfolio);
    setTransactions(updatedTransactions);
    
    savePortfolioToFirebase(updatedPortfolio);
    saveSettingsToFirebase({ transactions: updatedTransactions });
  };

  const handleSellItem = (id: any, sellQty: number) => {
    const today = getTodayString();
    let updatedTransactions = [...transactions];
    const updatedPortfolio = portfolio.map(item => {
      if (item.id === id) {
        updatedTransactions.push({ date: today, type: 'sell', amount: sellQty * item.currentPrice, account: item.account });
        return { ...item, qty: item.qty - sellQty };
      }
      return item;
    }).filter(item => item.qty > 0);

    setPortfolio(updatedPortfolio);
    setTransactions(updatedTransactions);

    savePortfolioToFirebase(updatedPortfolio);
    saveSettingsToFirebase({ transactions: updatedTransactions });
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

  const handleTargetChange = (type: 'asset' | 'risk', key: string, value: string) => {
    const val = parseFloat(value) || 0;
    if (type === 'asset') {
      const newRatios = { ...targetAssetRatios, [key]: val };
      setTargetAssetRatios(newRatios);
      saveSettingsToFirebase({ targetAssetRatios: newRatios });
    } else {
      const newRatios = { ...targetRiskRatios, [key]: val };
      setTargetRiskRatios(newRatios);
      saveSettingsToFirebase({ targetRiskRatios: newRatios });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 relative" style={{ fontFamily: 'NanumSquare, sans-serif' }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css');
        body, input, select, button, textarea {
          font-family: 'NanumSquare', sans-serif !important;
        }
      `}</style>
      
      <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

      {/* Target Config Modal */}
      {isTargetModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-2">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                목표 비중 설정 (Total 100%)
              </h3>
              <button onClick={() => setIsTargetModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Asset Class Targets */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex justify-between">
                  자산군별 목표
                  <span className={`text-xs ${Object.values(targetAssetRatios).reduce((a, b) => a + b, 0) === 100 ? 'text-green-600' : 'text-red-500'}`}>
                    합계: {Object.values(targetAssetRatios).reduce((a, b) => a + b, 0)}%
                  </span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {['주식', '채권', '암호화폐', '대체'].map(key => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-16">{key}</span>
                      <input 
                        type="number" 
                        className="w-full p-2 border rounded text-xs" 
                        value={targetAssetRatios[key] || 0} 
                        onChange={(e) => handleTargetChange('asset', key, e.target.value)} 
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Level Targets */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex justify-between">
                  위험등급별 목표
                  <span className={`text-xs ${Object.values(targetRiskRatios).reduce((a, b) => a + b, 0) === 100 ? 'text-green-600' : 'text-red-500'}`}>
                    합계: {Object.values(targetRiskRatios).reduce((a, b) => a + b, 0)}%
                  </span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {['초고위험', '고위험', '중고위험', '중위험', '저위험'].map(key => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-16">{key}</span>
                      <input 
                        type="number" 
                        className="w-full p-2 border rounded text-xs" 
                        value={targetRiskRatios[key] || 0} 
                        onChange={(e) => handleTargetChange('risk', key, e.target.value)} 
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setIsTargetModalOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-bold">
                저장 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-fade-in">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-bold text-gray-800">
                {activeModal.type === 'buy' ? '추가 매수 (물타기)' : '부분 매도'}
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
                  {activeModal.type === 'buy' ? '추가할 수량' : '매도할 수량'}
                </label>
                <input type="number" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center font-bold" value={modalInputs.qty} onChange={e => setModalInputs({...modalInputs, qty: e.target.value})} placeholder="0" autoFocus required />
                {activeModal.type === 'sell' && <p className="text-xs text-gray-500 mt-1 text-right">현재 보유: {formatNumber(activeModal.item.qty)}주</p>}
              </div>
              {activeModal.type === 'buy' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">매수 단가 (1주당)</label>
                  <input type="number" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center font-bold" value={modalInputs.price} onChange={e => setModalInputs({...modalInputs, price: e.target.value})} placeholder="0" required />
                  <p className="text-xs text-gray-500 mt-1 text-right">현재가: {formatCurrency(activeModal.item.currentPrice)}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={closeActiveModal} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition">취소</button>
                <button type="submit" className={`px-4 py-2 text-white rounded transition shadow-sm ${activeModal.type === 'buy' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-600'}`}>{activeModal.type === 'buy' ? '매수 반영' : '매도 반영'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            🧸 버핏이 되기 위하여,,
          </h1>
          <p className="text-sm text-gray-500">성원이와 소영이의 중장기 프로젝트</p>
        </div>
        <div className="flex items-center space-x-2">
          {user ? (
            <div className="flex items-center gap-2 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
              <Cloud className="w-3 h-3" /> 연동됨
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs">
              <CloudOff className="w-3 h-3" /> 연결 중...
            </div>
          )}
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"><Upload className="w-4 h-4" /> CSV</button>
          <button onClick={updatePrices} disabled={isUpdating} className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm text-sm ${isUpdating ? 'opacity-70' : ''}`}><RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />{isUpdating ? '갱신 중...' : '가격 시뮬레이션'}</button>
          <button onClick={handleResetData} className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 text-sm" title="초기화"><RotateCcw className="w-4 h-4" /> 초기화</button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
            <Filter className="w-4 h-4 text-gray-500" />
            🎨 필터 설정:
            <div className="flex gap-1 ml-2">
              <button 
                onClick={() => setFilterAccount('ALL')} 
                className={`px-4 py-1.5 text-sm rounded-lg border transition ${filterAccount === 'ALL' ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                전체 계좌
              </button>
              <button 
                onClick={() => setFilterAccount('성원')} 
                className={`px-4 py-1.5 text-sm rounded-lg border transition ${filterAccount === '성원' ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                🐵 성원 계좌
              </button>
              <button 
                onClick={() => setFilterAccount('소영')} 
                className={`px-4 py-1.5 text-sm rounded-lg border transition ${filterAccount === '소영' ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                🐶 소영 계좌
              </button>
            </div>
          </div>
        </div>
        
        {/* Exchange Rate Display */}
        <div className="w-full md:w-auto flex justify-center md:justify-end">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-100 rounded-lg text-green-800 text-sm font-medium shadow-sm">
            <Coins className="w-4 h-4 text-green-600" />
            <span>🇺🇸 USD/KRW</span>
            <span className="font-bold text-lg">{exchangeRate.toLocaleString()}</span>
            <span className="text-xs text-green-600">원</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-500 text-sm font-medium">총 평가 금액</h3>
            <Wallet className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight break-words">{formatCurrency(summary.totalValue)}</p>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
              <span className="flex items-center gap-1 truncate">
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
              <span className="font-semibold text-blue-600 whitespace-nowrap">{progressPercentage.toFixed(1)}% 달성</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
            </div>
          </div>
        </div>
        
        {/* Total Invested - Breakdown Added */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-500 text-sm font-medium">총 매입 금액</h3>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight break-words mb-3">{formatCurrency(summary.totalInvested)}</p>
          <div className="space-y-1 pt-2 border-t border-gray-50">
            {subSummary.map((item) => (
               <div key={item.key} className="flex justify-between text-xs text-gray-500">
                 <span>{item.key}</span>
                 <span className="font-medium">{formatCurrency(item.invested)}</span>
               </div>
            ))}
          </div>
        </div>

        {/* Total P/L - Breakdown Added */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
           <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-500 text-sm font-medium">평가 손익</h3>
            {summary.totalPL >= 0 ? <TrendingUp className="w-5 h-5 text-red-500" /> : <TrendingDown className="w-5 h-5 text-blue-500" />}
          </div>
          <p className={`text-xl sm:text-2xl font-bold tracking-tight break-words mb-3 ${summary.totalPL >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
            {summary.totalPL >= 0 ? '+' : ''}{formatCurrency(summary.totalPL)}
          </p>
          <div className="space-y-1 pt-2 border-t border-gray-50">
            {subSummary.map((item) => (
               <div key={item.key} className="flex justify-between text-xs">
                 <span className="text-gray-500">{item.key}</span>
                 <span className={`font-medium ${item.pl >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                   {item.pl >= 0 ? '+' : ''}{formatCurrency(item.pl)}
                 </span>
               </div>
            ))}
          </div>
        </div>

        {/* Return Rate - Breakdown Added */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-500 text-sm font-medium">수익률</h3>
            <PieChartIcon className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex items-end gap-2 mb-3">
            <p className={`text-xl sm:text-2xl font-bold tracking-tight ${summary.returnRate >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
              {summary.returnRate.toFixed(2)}%
            </p>
          </div>
          <div className="space-y-1 pt-2 border-t border-gray-50">
            {subSummary.map((item) => (
               <div key={item.key} className="flex justify-between text-xs">
                 <span className="text-gray-500">{item.key}</span>
                 <span className={`font-medium ${item.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                   {item.returnRate.toFixed(2)}%
                 </span>
               </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: Asset Allocation & Risk Charts (Horizontal Bar with Targets) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              📊 자산군별 비중
            </h3>
            <button onClick={() => setIsTargetModalOpen(true)} className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition">
              <Target className="w-3 h-3" /> 타겟 설정
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={assetAllocationData}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{fontSize: 11}} xAxisId={0} />
                <XAxis type="number" domain={[0, 100]} unit="%" xAxisId={1} hide />
                <YAxis dataKey="name" type="category" width={60} tick={{fontSize: 12, fontWeight: 'bold'}} />
                <RechartsTooltip content={<ComparisonTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="target" name="목표 비중" fill="#dbeafe" barSize={20} radius={[0, 4, 4, 0]} xAxisId={0} />
                <Bar dataKey="current" name="현재 비중" fill="#3b82f6" barSize={10} radius={[0, 4, 4, 0]} xAxisId={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              🚨 위험도별 비중
            </h3>
            <button onClick={() => setIsTargetModalOpen(true)} className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition">
              <Target className="w-3 h-3" /> 타겟 설정
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={riskAllocationData}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{fontSize: 11}} xAxisId={0} />
                <XAxis type="number" domain={[0, 100]} unit="%" xAxisId={1} hide />
                <YAxis dataKey="name" type="category" width={60} tick={{fontSize: 12, fontWeight: 'bold'}} />
                <RechartsTooltip content={<ComparisonTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="target" name="목표 비중" fill="#fef3c7" barSize={20} radius={[0, 4, 4, 0]} xAxisId={0} />
                <Bar dataKey="current" name="현재 비중" fill="#f59e0b" barSize={10} radius={[0, 4, 4, 0]} xAxisId={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Investment History Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-500" />
            📈 투자 내역 분석
          </h3>
          <div className="flex gap-2">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => setChartPeriod('daily')}
                className={`px-3 py-1 text-xs rounded-md transition ${chartPeriod === 'daily' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
              >
                일별
              </button>
              <button 
                onClick={() => setChartPeriod('weekly')}
                className={`px-3 py-1 text-xs rounded-md transition ${chartPeriod === 'weekly' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
              >
                주별
              </button>
              <button 
                onClick={() => setChartPeriod('monthly')}
                className={`px-3 py-1 text-xs rounded-md transition ${chartPeriod === 'monthly' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
              >
                월별
              </button>
            </div>
          </div>
        </div>
        
        <div className="h-64 sm:h-80 w-full">
          {composedChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={composedChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid stroke="#f5f5f5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(val) => `${val}만`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend />
                <Bar yAxisId="left" dataKey="buy" name="매수 금액 (만원)" fill="#ef4444" barSize={20} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="buy" position="top" fill="#ef4444" fontSize={10} formatter={(val: number) => val > 0 ? `${val}만` : ''} />
                </Bar>
                <Bar yAxisId="left" dataKey="sell" name="매도 금액 (만원)" fill="#3b82f6" barSize={20} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="sell" position="top" fill="#3b82f6" fontSize={10} formatter={(val: number) => val > 0 ? `${val}만` : ''} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="returnRate" name="수익률 (%)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }}>
                  <LabelList dataKey="returnRate" position="top" fill="#10b981" fontSize={10} formatter={(val: number) => `${val}%`} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              표시할 데이터가 없습니다. 종목을 추가해보세요.
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Portfolio Heatmap (Full Width) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4">🧩 보유 종목 현황</h3>
        <div className="h-96 w-full">
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

      {/* Holdings Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <h3 className="text-lg font-bold text-gray-800">📋 보유 종목 상세</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => requestSort('risk')} className={getSortButtonClass('risk')}>
                위험등급순 {sortConfig.key === 'risk' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
              </button>
              <button onClick={() => requestSort('invested')} className={getSortButtonClass('invested')}>
                매수금액순 {sortConfig.key === 'invested' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
              </button>
              <button onClick={() => requestSort('value')} className={getSortButtonClass('value')}>
                평가금액순 {sortConfig.key === 'value' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
              </button>
              <button onClick={() => requestSort('returnRate')} className={getSortButtonClass('returnRate')}>
                수익률순 {sortConfig.key === 'returnRate' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
              </button>
            </div>
          </div>
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-1 text-sm bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-800 w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" /> 종목 추가
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <form onSubmit={handleAddItem} className="bg-gray-50 p-6 border-b border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">티커 입력</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="예: AAPL, SOXL, BTC" 
                  className="w-full p-2 border rounded border-blue-300 ring-1 ring-blue-100" 
                  value={newItem.ticker} 
                  onChange={handleTickerChange} 
                  required 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">종목명 / 자산군</label>
              <div className="flex gap-2">
                 <input type="text" placeholder="종목명" className="w-1/2 p-2 border rounded bg-gray-50" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} required />
                 <select className="w-1/2 p-2 border rounded text-xs bg-gray-50" value={newItem.assetClass} onChange={e => setNewItem({...newItem, assetClass: e.target.value})}>
                  <option value="주식">주식</option>
                  <option value="채권">채권</option>
                  <option value="암호화폐">암호화폐</option>
                  <option value="대체">대체</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">위험등급 / 수량 / 매수가</label>
              <div className="flex gap-2">
                 <select className="w-1/3 p-2 border rounded text-xs bg-gray-50" value={newItem.risk} onChange={e => setNewItem({...newItem, risk: e.target.value})}>
                  <option value="초고위험">초고위험</option>
                  <option value="고위험">고위험</option>
                  <option value="중위험">중위험</option>
                  <option value="저위험">저위험</option>
                </select>
                <input 
                  type="number" 
                  placeholder="수량" 
                  className="w-1/3 p-2 border rounded" 
                  value={newItem.qty} 
                  onChange={e => setNewItem({...newItem, qty: e.target.value})} 
                  required 
                />
                <input 
                  type="number" 
                  placeholder="단가" 
                  className="w-1/3 p-2 border rounded" 
                  value={newItem.avgPrice} 
                  onChange={e => setNewItem({...newItem, avgPrice: e.target.value})} 
                  required 
                />
              </div>
            </div>
            <div className="flex items-end">
               <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded">추가</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          {/* table-fixed 클래스 추가: 열 너비를 고정하여 페이지 이동 시 흔들림 방지 */}
          <table className="w-full text-sm text-center text-gray-500 table-fixed">
            <thead className="text-sm text-gray-700 uppercase bg-gray-50">
              <tr>
                {/* 각 컬럼에 적절한 너비(width) 할당 */}
                <th className="px-2 py-3 text-center w-[8%] hidden xl:table-cell">자산군</th>
                <th className="px-2 py-3 text-center w-[12%] hidden lg:table-cell">위험등급</th>
                <th className="px-2 py-3 text-center">종목명</th>
                <th className="px-2 py-3 text-center w-[10%] whitespace-nowrap hidden sm:table-cell">수량</th>
                <th className="px-2 py-3 text-center w-[12%] whitespace-nowrap hidden lg:table-cell">매수단가</th>
                <th className="px-2 py-3 text-center w-[12%] whitespace-nowrap hidden md:table-cell">매수금액</th>
                <th className="px-2 py-3 text-center w-[12%] whitespace-nowrap">평가금액</th>
                <th className="px-2 py-3 text-center w-[10%] whitespace-nowrap">수익률</th>
                <th className="px-2 py-3 text-center w-[100px] whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((item: any) => {
                 const totalVal = item.currentPrice * item.qty;
                 const invested = item.avgPrice * item.qty;
                 const roi = invested > 0 ? ((totalVal - invested) / invested) * 100 : 0;
                 return (
                  <tr key={item.id} className="bg-white border-b hover:bg-gray-50 group">
                    <td className="px-2 py-4 text-center font-medium text-gray-600 whitespace-nowrap hidden xl:table-cell overflow-hidden text-ellipsis">{item.assetClass}</td>
                    <td className="px-2 py-4 text-center hidden lg:table-cell">
                      <div className="flex justify-center">
                        <RiskBadge level={item.risk} />
                      </div>
                    </td>
                    <td className="px-2 py-4 text-center font-medium text-gray-900">
                      <div className="flex flex-col items-center">
                        <div className="truncate w-full px-2" title={item.name}>{item.name}</div>
                        <div className="text-xs text-gray-400">{item.ticker}</div>
                        {/* Mobile Only Info */}
                        <div className="sm:hidden text-xs text-gray-500 mt-1">
                          {formatNumber(item.qty)}주
                        </div>
                      </div>
                    </td>
                    
                    {/* Editable Quantity */}
                    <td
                        className="px-2 py-4 text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors hidden sm:table-cell"
                        onClick={() => handleStartEdit(item, 'qty')}
                        title="클릭하여 수량 수정"
                    >
                       {editingCell && editingCell.id === item.id && editingCell.field === 'qty' ? (
                          <input 
                            ref={editInputRef}
                            type="number" 
                            className="w-20 p-1 border rounded text-center text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={handleKeyDown}
                          />
                      ) : (
                          <div className="flex items-center justify-center gap-1 group">
                             <span>{formatNumber(item.qty)}</span>
                             <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                      )}
                    </td>

                    {/* New Editable Unit Price (매수 단가) */}
                    <td
                        className="px-2 py-4 text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors hidden lg:table-cell"
                        onClick={() => handleStartEdit(item, 'avgPrice')}
                        title="클릭하여 매수 단가 수정"
                    >
                      {editingCell && editingCell.id === item.id && editingCell.field === 'avgPrice' ? (
                          <input 
                            ref={editInputRef}
                            type="number" 
                            className="w-24 p-1 border rounded text-center text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={handleKeyDown}
                          />
                      ) : (
                          <div className="flex items-center justify-center gap-1 group">
                             <span>{formatCurrency(item.avgPrice)}</span>
                             <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                      )}
                    </td>

                    <td className="px-2 py-4 text-center text-gray-600 text-sm whitespace-nowrap hidden md:table-cell">
                       {formatCurrency(invested)}
                    </td>

                    <td className={`px-2 py-4 text-center font-bold whitespace-nowrap ${roi >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
                        {formatCurrency(totalVal)}
                    </td>

                    <td className={`px-2 py-4 text-center font-medium whitespace-nowrap ${roi >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
                      {roi.toFixed(2)}%
                    </td>

                    <td className="px-2 py-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openBuyModal(item); }} 
                          className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition shadow-sm"
                          title="추가 매수"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openSellModal(item); }} 
                          className="p-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 transition shadow-sm"
                          title="부분 매도"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer */}
            <tfoot className="bg-gray-100 font-semibold text-gray-900">
              <tr>
                <td colSpan={3} className="px-2 py-3 text-center border-t border-gray-200 text-sm whitespace-nowrap hidden xl:table-cell">
                  {filterAccount !== 'ALL' ? '필터링 합계' : '총 합계'}
                </td>
                {/* Mobile/Tablet adjustments for footer colspan */}
                <td colSpan={2} className="px-2 py-3 text-center border-t border-gray-200 text-sm whitespace-nowrap xl:hidden">
                   합계
                </td>

                <td className="px-2 py-3 text-center border-t border-gray-200 text-sm whitespace-nowrap hidden sm:table-cell"></td>
                <td className="px-2 py-3 text-center border-t border-gray-200 text-sm whitespace-nowrap hidden lg:table-cell"></td>

                <td className="px-2 py-3 text-center border-t border-gray-200 text-sm whitespace-nowrap hidden md:table-cell">
                  {formatCurrency(summary.totalInvested)}
                </td>
                <td className="px-2 py-3 text-center border-t border-gray-200 text-blue-900 text-sm whitespace-nowrap">
                  {formatCurrency(summary.totalValue)}
                </td>
                <td className="px-2 py-3 text-center border-t border-gray-200 text-sm whitespace-nowrap">
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

       <div className="mt-4 text-center text-xs text-gray-400 pb-8">
        💡 수량 또는 단가를 클릭하여 즉시 수정할 수 있습니다.
      </div>
    </div>
  );
}