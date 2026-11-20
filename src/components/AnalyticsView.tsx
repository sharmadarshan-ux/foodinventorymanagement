/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Sparkles, 
  UtensilsCrossed, 
  AlertTriangle, 
  Lightbulb, 
  Clock, 
  ChevronRight, 
  CheckSquare, 
  Square,
  RefreshCw,
  PieChart,
  BarChart,
  Trash2,
  CheckCircle,
  HelpCircle,
  Play
} from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../api';
import { AnalyticsPattern, GeminiRecommendation, GeminiRecipe } from '../types';

export default function AnalyticsView() {
  const [analytics, setAnalytics] = useState<AnalyticsPattern[]>([]);
  const [recommendations, setRecommendations] = useState<GeminiRecommendation[]>([]);
  const [recipes, setRecipes] = useState<GeminiRecipe[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep track of checklisted ingredients for recipes
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, recRes, recipesRes] = await Promise.all([
        api.getAnalytics(),
        api.getRecommendations(),
        api.getRecipes()
      ]);
      setAnalytics(analyticsRes);
      setRecommendations(recRes);
      setRecipes(recipesRes);
    } catch (err: any) {
      console.error('Failed to load analytics panel:', err);
      setError('Could not connect to the Gemini Analytics service. Please ensure the FastAPI server is running with API keys loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const toggleIngredient = (recipeId: string, ingredient: string) => {
    const key = `${recipeId}-${ingredient}`;
    setCheckedIngredients(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getImpactStyle = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'bg-rose-50 border-rose-100 text-rose-700 font-bold';
      case 'MEDIUM':
        return 'bg-amber-50 border-amber-100 text-amber-700 font-bold';
      default:
        return 'bg-blue-50 border-blue-100 text-blue-700 font-bold';
    }
  };

  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case 'HARD':
        return 'bg-rose-100 text-rose-800';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-emerald-100 text-emerald-800';
    }
  };

  // Compute stats for visualization
  const totalStocked = analytics.reduce((acc, curr) => acc + curr.total_stocked, 0);
  const totalConsumed = analytics.reduce((acc, curr) => acc + curr.consumed_qty, 0);
  const totalWasted = analytics.reduce((acc, curr) => acc + curr.wasted_qty, 0);
  const avgWasteRate = totalStocked > 0 ? Number(((totalWasted / totalStocked) * 100).toFixed(1)) : 0;

  return (
    <div className="space-y-6">
      
      {/* Loading indicator */}
      {loading && analytics.length === 0 && (
        <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-xs">
          <RefreshCw className="h-10 w-10 animate-spin text-emerald-600 mb-3" />
          <p className="font-display font-semibold text-slate-800">Compiling Waste Metrics & Recipes...</p>
          <p className="text-xs text-slate-500">Retrieving Gemini Insights</p>
        </div>
      )}

      {/* Error container */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-display font-bold text-rose-900">Gemini Analytics Service Unreachable</h3>
              <p className="text-sm text-rose-700">{error}</p>
              <button
                onClick={loadAnalyticsData}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && analytics.length > 0 && (
        <div className="space-y-6">
          
          {/* Top Panel: Analytics Overview & Waste Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: General Kitchen Efficiency */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <PieChart className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-display font-bold text-slate-900 text-sm md:text-base">Kitchen Efficiency</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Real-time aggregation of your food stock lifecycle. Tracks the percentage of food consumed vs items thrown away.
                </p>
              </div>

              {/* Progress Bar Chart */}
              <div className="my-6 space-y-4">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Consumption Efficiency</span>
                  <span className="font-mono text-emerald-600">{Number((100 - avgWasteRate).toFixed(1))}%</span>
                </div>
                <div className="h-6 w-full bg-rose-100 rounded-full overflow-hidden flex shadow-inner">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500" 
                    style={{ width: `${100 - avgWasteRate}%` }} 
                    title={`Consumed: ${totalConsumed.toFixed(1)} units`}
                  />
                  <div 
                    className="h-full bg-rose-500 transition-all duration-500" 
                    style={{ width: `${avgWasteRate}%` }} 
                    title={`Wasted: ${totalWasted.toFixed(1)} units`}
                  />
                </div>
                
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-md bg-emerald-500" />
                    <span>Consumed ({totalConsumed.toFixed(1)})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-md bg-rose-500" />
                    <span>Wasted ({totalWasted.toFixed(1)})</span>
                  </div>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Stock Volume</p>
                  <p className="font-mono text-lg font-bold text-slate-800">{totalStocked.toFixed(0)} <span className="text-xs font-normal text-slate-500">units</span></p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Waste Rate</p>
                  <p className={`font-mono text-lg font-bold ${avgWasteRate > 15 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {avgWasteRate}%
                  </p>
                </div>
              </div>

            </div>

            {/* Right: Category-wise Waste Rates Custom Chart */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <BarChart className="h-5 w-5 text-emerald-600" />
                <h3 className="font-display font-bold text-slate-900 text-sm md:text-base">Waste Rate per Product</h3>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                Detailed breakdown of product-specific waste. Products with waste rates exceeding 15% are flagged for priority optimization.
              </p>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {analytics.map((item) => {
                  const isHighWaste = item.waste_rate >= 15;
                  return (
                    <div key={item.id || item.product_name} className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">{item.product_name}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] text-slate-500">
                            {item.category}
                          </span>
                        </div>
                        <span className={`font-mono font-bold ${isHighWaste ? 'text-rose-600' : 'text-slate-600'}`}>
                          {item.waste_rate}% waste
                        </span>
                      </div>
                      
                      <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHighWaste ? 'bg-gradient-to-r from-orange-500 to-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${item.waste_rate}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Consumed: {item.consumed_qty}</span>
                        <span>Wasted: {item.wasted_qty} / {item.total_stocked}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Bottom Panel: Recommendations and Recipe Engine */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Left Column: Gemini Waste-Reduction Recommendations */}
            <div className="md:col-span-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-slate-900 text-sm md:text-base">Gemini Sourcing Advices</h3>
                    <p className="text-[10px] text-slate-500">AI recommendations to trim wasteful spends</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {recommendations.map((rec) => (
                    <div 
                      key={rec.id} 
                      className={`p-4 rounded-xl border flex flex-col gap-2 transition-all hover:shadow-xs ${getImpactStyle(rec.impact_level)}`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-display font-bold text-slate-900 text-sm">{rec.title}</h4>
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-white border border-black/10">
                          {rec.impact_level} Impact
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-normal">
                        {rec.advice}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Tonight's Dinner Recipes Engine */}
            <div className="md:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
                      <UtensilsCrossed className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-slate-900 text-sm md:text-base">Tonight's Recipes</h3>
                      <p className="text-[10px] text-slate-500">Using ingredients expiring within 5 days</p>
                    </div>
                  </div>
                  <div className="rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 flex items-center gap-1 border border-emerald-100">
                    <Sparkles className="h-3 w-3 animate-pulse" />
                    Gemini-Curated
                  </div>
                </div>

                {recipes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm font-semibold text-slate-700">No Recipe Advice Required</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      All your food stock has comfortable expiry buffers. No ingredients are in danger of wasting.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {recipes.map((rcp) => (
                      <div 
                        key={rcp.id} 
                        className="rounded-xl border border-slate-100 p-4 space-y-3.5 hover:shadow-md transition-shadow bg-slate-50/50"
                      >
                        {/* Recipe Header */}
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div>
                            <h4 className="font-display font-bold text-slate-900 text-base">{rcp.recipe_name}</h4>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                {rcp.estimated_time}
                              </span>
                              <span>•</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold font-mono ${getDifficultyStyle(rcp.difficulty)}`}>
                                {rcp.difficulty}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Ingredients checklist */}
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expiring Ingredients Used:</p>
                          <div className="flex flex-wrap gap-2">
                            {rcp.ingredients_used.map((ing) => {
                              const isChecked = !!checkedIngredients[`${rcp.id}-${ing}`];
                              return (
                                <button
                                  key={ing}
                                  onClick={() => toggleIngredient(rcp.id, ing)}
                                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer ${
                                    isChecked
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 line-through decoration-slate-400'
                                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  {isChecked ? (
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <div className="h-3 w-3 rounded-full border border-slate-300" />
                                  )}
                                  {ing}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Cooking instructions */}
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Step-by-Step Guide:</p>
                          <ol className="space-y-1.5 text-xs text-slate-700 leading-relaxed list-decimal list-inside pl-1">
                            {rcp.instructions.map((step, idx) => (
                              <li key={idx} className="marker:font-mono marker:font-bold marker:text-emerald-700 pl-1">
                                <span className="font-normal text-slate-800">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
