import { Observable } from 'rxjs/Rx';

const elSwiper = document.querySelector('.swiper');
const elList = elSwiper.querySelector('.swiper__list');
const elIndicator = elSwiper.querySelector('.swiper__indicator');
const elPrevious = elSwiper.querySelector('.swiper__button--prev');
const elNext = elSwiper.querySelector('.swiper__button--next');
const count = elList.querySelectorAll('.swiper__item').length - 1;

// pointerdownイベントをObservableに変換
const pointerdown$ = Observable.fromEvent(elList, 'pointerdown', {
  passive: true,
});

// pointermoveイベントをObservableに変換
const pointermove$ = Observable.fromEvent(window, 'pointermove', {
  passive: true,
});

// pointerupイベントをObservableに変換
const pointerup$ = Observable.fromEvent(window, 'pointerup', {
  passive: true,
});

// dragstartイベントをObservableに変換
const dragstart$ = Observable.fromEvent(elList, 'dragstart');

// pointerdown$, pointermove$, pointerup$を利用して
// ドラッグ中に、「引数のオブジェクトに移動距離をマージする」コールバック関数をemitするObservableを生成する
const dragging$ = pointerdown$
  // `mergeMap`メソッドで、pointerdown中からpointerupするまでのポインタの移動距離をemitするObservableを生成する
  .mergeMap(start =>
    // `takeUntil`メソッドで、pointerup$がemitされるまで値をemitするObservableに変換
    // `map`メソッドでスタート地点からポインタの移動距離をemitするObservableに変換
    pointermove$.takeUntil(pointerup$).map(move => move.pageX - start.pageX)
  )
  // 「移動距離を引数のオブジェクトにマージする」コールバック関数をemitするObservableを生成する
  .map(deltaX => state => Object.assign({}, state, { deltaX }));

// dragging$, pointerup$を利用して
// ドラッグ終了後のindexを返すコールバック関数をemitするObservableを生成する
const dragend$ = dragging$
  // pointerup$.take(1)にすることで
  // switchMapが再び実行されるまで、pointerupイベントが何回発生しても
  // イベントは配信されなくなる
  .switchMap(() => pointerup$.take(1))
  // dragging$ Observableから最後に配信された値（今回はコールバック関数）を取得
  .withLatestFrom(dragging$)
  // dragging$ Observableから配信されたコールバックを関数を引数にして
  // indexを返すコールバック関数をemitするObservableを生成する
  .map(([, fn]) => ({ index }) => {
    const { deltaX } = fn();
    index = index < count && deltaX < -50 ? index + 1 : index;
    index = index > 0 && deltaX > 50 ? index - 1 : index;
    return { index };
  });

/**
 * NEXTボタンををクリック時、インデックスを更新し、それを返すコールバック関数をemitするObservable
 */
const next$ = Observable.fromEvent(elNext, 'click').map(() => ({ index }) => ({
  index: index < count ? index + 1 : 0,
}));

/**
 * PREVボタンををクリック時、インデックスを更新し、それを返すコールバック関数をemitするObservable
 */
const previous$ = Observable.fromEvent(elPrevious, 'click').map(
  () => ({ index }) => ({
    index: index > 0 ? index - 1 : count,
  })
);

/**
 * インディケータをクリック時、クリックしたインディケータのインデックスを返すコールバック関数をemitするObservable
 */
const indication$ = Observable.fromEvent(elIndicator, 'click')
  .map(el => el.target.closest('.swiper__indication'))
  .filter(el => el !== null)
  .map(el => () => ({ index: parseInt(el.dataset.index, 10) }));

Observable.merge(dragging$, dragend$, previous$, next$, indication$)
  // state の初期値は`{ deltaX: 0, index: 0 }`
  // `changeFn`には各Observableからemitされたコールバック関数が参照される
  .scan((state, changeFn) => changeFn(state), { deltaX: 0, index: 0 })
  .subscribe(({ deltaX, index }) => {
    const width = -(
      index *
      (parseInt(window.getComputedStyle(elSwiper).width, 10) + 10)
    );
    if (deltaX !== undefined) {
      translateX(elList, width + deltaX);
    } else {
      translateX(elList, width, 0.2, () => {
        updateIndicator(elIndicator, index);
      });
    }
  });

dragstart$
  .filter(e => e.target.closest('.product-card__image'))
  .subscribe(e => e.preventDefault());

/**
 * elementのtranslateXを更新する
 * @param {*} element
 * @param {*} deltaX
 * @param {*} duration
 * @param {*} callback
 */
function translateX(element, deltaX, duration = 0, callback = null) {
  element.style.transition = `transform ${duration}s`;
  element.style.transform = `translate3d(${deltaX}px, 0, 0)`;
  if (duration > 0 && callback) {
    element.addEventListener('transitionend', callback, { once: true });
  }
}

/**
 * インディケータのViewを更新する
 * @param {*} element
 * @param {*} index
 */
function updateIndicator(element, index) {
  element
    .querySelector('.swiper__indication--active')
    .classList.remove('swiper__indication--active');
  element
    .querySelector(`.swiper__indication:nth-child(${index + 1})`)
    .classList.add('swiper__indication--active');
}
