import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Text, SafeAreaView, StyleSheet, View, TextInput, TouchableOpacity, Dimensions, Keyboard, Alert } from 'react-native';
import * as Speech from 'expo-speech';
import Slider from '@react-native-community/slider';

// --- CONSTANTS ---
const COLS = 10;
const screenWidth = Dimensions.get('window').width;
const gap = 4;
const containerPadding = 20;
const chartPadding = 4;
const totalGaps = (COLS - 1) * gap;
const availableWidth = screenWidth - (containerPadding * 2) - (chartPadding * 2);
const cellSize = (availableWidth - totalGaps) / COLS ;

export default function App() {
  // --- STATE MANAGEMENT ---
  const [inputValue, setInputValue] = useState('');
  const [highlightedMultiples, setHighlightedMultiples] = useState([]);
  const [currentSequential, setCurrentSequential] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mode, setMode] = useState('multiples');
  const [showZero, setShowZero] = useState(false);
  // NEW: State for speed level (1-10)
  const [speedLevel, setSpeedLevel] = useState(5); 

  // --- REFS ---
  const intervalRef = useRef(null);
  const animationStepRef = useRef(0);

  const numbers = Array.from({ length: 100 }, (_, i) => i + 1);

  // --- FUNCTION DEFINITIONS ---

  // playSound is now wrapped in useCallback because it depends on speedLevel
  const playSound = useCallback((number) => {
    const thingToSay = String(number);
    // Map speedLevel (1-10) to a speech rate (e.g., 0.8 to 2.0)
    const minRate = 0.8;
    const maxRate = 2.0;
    const speechRate = minRate + (speedLevel - 1) * ((maxRate - minRate) / 9);

    Speech.speak(thingToSay, {
      language: 'zh-TW',
      rate: speechRate,
    });
  }, [speedLevel]); // Re-create this function only if speedLevel changes

  // --- LIFECYCLE HOOKS ---
  useEffect(() => {
    return () => {
      stopAnimation();
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (currentSequential !== null && isAnimating) {
      playSound(currentSequential);
    }
  }, [currentSequential, isAnimating, playSound]);

  const handleInputChange = (text) => {
    setInputValue(text);
    if (mode === 'multiples') {
      const num = parseInt(text, 10);
      if (!isNaN(num) && num > 0) {
        setHighlightedMultiples(numbers.filter(n => n % num === 0));
      } else {
        setHighlightedMultiples([]);
      }
    }
  };

  const startAnimation = () => {
    Keyboard.dismiss();
    stopAnimation();
    if (mode === 'multiples') {
      animateMultiples();
    } else if (mode === 'addition') {
      animateAddition();
    }
  };

  // Function to calculate the animation interval from the speed level
  const getAnimationInterval = () => {
    const minInterval = 200; // Fastest
    const maxInterval = 1500; // Slowest
    // Invert the mapping: higher speedLevel => lower interval
    return maxInterval - (speedLevel - 1) * ((maxInterval - minInterval) / 9);
  };

  const animateMultiples = () => {
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < 1) {
      Alert.alert("輸入錯誤", "請在倍數模式下輸入一個有效的數字。");
      return;
    }
    
    setIsAnimating(true);
    let currentMultiple = num;
    setCurrentSequential(currentMultiple);
    
    intervalRef.current = setInterval(() => {
      const nextMultiple = currentMultiple + num;
      if (nextMultiple > 100) {
        stopAnimation(false);
      } else {
        currentMultiple = nextMultiple;
        setCurrentSequential(currentMultiple);
      }
    }, getAnimationInterval()+250);
  };

  const animateAddition = () => {
    const parsed = inputValue.match(/(\d+)\s*([+-])\s*(\d+)/);
    if (!parsed) {
      Alert.alert("輸入錯誤", "請輸入有效的運算式，例如 'A+B' 或 'A-B'。");
      return;
    }
    const [, numA, operator, numB] = parsed;
    const startNum = parseInt(numA, 10);
    const totalMove = parseInt(numB, 10);
    const direction = operator === '+' ? 1 : -1;
    const finalResult = startNum + (totalMove * direction);
      
    if (startNum < 1 || startNum > 100 || finalResult < 0 || finalResult > 100) {
      Alert.alert("無效操作", `運算必須在 0 到 100 的範圍内。`);
      return;
    }

    const tens = Math.floor(totalMove / 10);
    const ones = totalMove % 10;
    
    animationStepRef.current = 0;
    setIsAnimating(true);
    setCurrentSequential(startNum);
    
    intervalRef.current = setInterval(() => {
      animationStepRef.current++;
      
      let currentNumber;
      if (animationStepRef.current <= tens) {
        currentNumber = startNum + (animationStepRef.current * 10 * direction);
      } else {
        const baseAfterTens = startNum + (tens * 10 * direction);
        const oneSteps = animationStepRef.current - tens;
        currentNumber = baseAfterTens + (oneSteps * direction);
      }

      if (currentNumber > 100 || currentNumber < 0) {
        stopAnimation(false);
        return;
      }

      if (animationStepRef.current >= (tens + ones)) {
        playSound(finalResult); 
        setCurrentSequential(finalResult);
        if (finalResult === 0) {
          setShowZero(true);
        }
        stopAnimation(false);
      } else {
        setCurrentSequential(currentNumber);
      }
    }, getAnimationInterval()+250);
  };

  const stopAnimation = (shouldStopSpeech = true) => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsAnimating(false);
    if (shouldStopSpeech) {
      Speech.stop();
    }
  };
  
  const resetChart = () => {
    stopAnimation();
    setInputValue('');
    setHighlightedMultiples([]);
    setCurrentSequential(null);
    setShowZero(false);
    animationStepRef.current = 0;
  };
  
  const switchMode = (newMode) => {
    if (isAnimating) return;
    resetChart();
    setMode(newMode);
    if (newMode === 'addition') {
      setHighlightedMultiples([]);
    }
  }

  // --- RENDER ---
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>百數表 (Hundreds Chart)</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.inputRow}>
            <Text style={styles.label}>
                {mode === 'multiples' ? '请输入N (1～100 的整数)' : '请输入運算式 (A±B)'}
            </Text>
            <TextInput
                style={styles.input}
                keyboardType={mode === 'multiples' ? "number-pad" : "default"}
                value={inputValue}
                onChangeText={handleInputChange}
                placeholder={mode === 'multiples' ? "例如：5" : "例如：12+5"}
                editable={!isAnimating}
            />
        </View>
        <View style={styles.buttonRow}>
            <TouchableOpacity 
                style={[styles.button, styles.modeBtn, mode === 'multiples' ? styles.activeMode : styles.inactiveMode]} 
                onPress={() => switchMode('multiples')} 
                disabled={isAnimating}>
                <Text style={styles.buttonText}>倍數模式</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.button, styles.modeBtn, mode === 'addition' ? styles.activeMode : styles.inactiveMode]} 
                onPress={() => switchMode('addition')} 
                disabled={isAnimating}>
                <Text style={styles.buttonText}>加減模式</Text>
            </TouchableOpacity>
        </View>
        <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.startBtn, isAnimating && styles.disabledButton]} onPress={startAnimation} disabled={isAnimating}>
                <Text style={styles.buttonText}>開始</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.stopBtn]} onPress={stopAnimation}>
                <Text style={styles.buttonText}>停止</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.resetBtn]} onPress={resetChart}>
                <Text style={styles.buttonText}>重置</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.sliderContainer}>
          <Text style={styles.label}>速度 (慢 «-» 快)</Text>
          <Slider
            style={{width: 200, height: 40, flex:1}}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={speedLevel}
            onSlidingComplete={setSpeedLevel}
            minimumTrackTintColor="#0059d3"
            maximumTrackTintColor="#d1d5db"
            thumbTintColor="#0059d3"
          />
        </View>
      </View>

      <View style={styles.chartGrid}>
        {showZero && (
            <View style={[styles.chartCell, currentSequential === 0 && styles.highlightSequential]}>
              <Text style={[styles.cellText, currentSequential === 0 && styles.highlightedText]}>0</Text>
            </View>
        )}
        {numbers.map((number) => {
          const isMultiple = highlightedMultiples.includes(number);
          const isSequential = number === currentSequential;
          return (
            <View 
              key={number} 
              style={[
                styles.chartCell, 
                isMultiple && styles.highlightMultiple,
                isSequential && styles.highlightSequential
              ]}
            >
              <Text style={[styles.cellText, (isMultiple || isSequential) && styles.highlightedText]}>{number}</Text>
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// --- STYLESHEET ---
const styles = StyleSheet.create({
    container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: containerPadding,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0059d3', 
    textAlign: 'center',
  },
  controls: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  input: {
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 150,
    textAlign: 'left',
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  startBtn: {
    backgroundColor: '#0059d3', 
  },
  stopBtn: {
    backgroundColor: '#ef4444',
  },
  resetBtn: {
    backgroundColor: '#6b7280',
  },
  modeBtn: {},
  activeMode: {
    backgroundColor: '#5b21b6',
  },
  inactiveMode: {
    backgroundColor: '#a78bfa',
  },
  disabledButton: {
      backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sliderContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  chartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#cbd5e1',
    borderRadius: 8,
    padding: chartPadding,
    justifyContent: 'flex-start',

  },
  chartCell: {
    width: cellSize,
    height: cellSize,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 2,
    margin: gap / 2,
    marginLeft: 5,
  },
  cellText: {
    fontWeight: '600',
    fontSize: cellSize * 0.45,
    color: '#1e293b',
  },
  highlightMultiple: {
    backgroundColor: '#60a5fa',
  },
  highlightSequential: {
    backgroundColor: '#facc15',
    transform: [{ scale: 1.1 }],
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  highlightedText: {
    color: 'white',
  },
});