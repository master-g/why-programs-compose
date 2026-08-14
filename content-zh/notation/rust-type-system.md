---
title: "Rust 类型系统速查"
tags: ["why-programs-compose"]
---
一行 Rust 函数签名里可以同时出现四类记号：类型参数、trait 约束、闭包档位、生命周期标注。本篇把这些记号逐条拆开，目标是读懂它们，不是教怎么设计 Rust 程序。[Rust 中的函数组合](../categories/composition-in-rust/) 讲的是这些记号在组合链里带来的后果——闭包档位怎么传染、类型推断从哪里找线索、捕获环境要怎么交代——本篇只管记号本身，遇到要展开的地方指过去。同为记号地基的还有 [集合与函数](../notation/sets-and-functions/) 与 [Haskell 记号速读](../notation/haskell-notation/)。

拆的对象就是 [范畴](../categories/category/) 里那个十行的组合函数：

```rust
fn compose<A, B, C>(f: impl Fn(A) -> B, g: impl Fn(B) -> C) -> impl Fn(A) -> C {
    move |x| g(f(x))
}
```

尖括号里的 `A`、`B`、`C` 是类型参数；参数位上的 `impl Fn(A) -> B` 是一条 trait 约束；返回位上的 `impl Fn(A) -> C` 看着是同一个记号，含义是另一回事。下面按这个顺序说。

## 泛型参数与单态化

尖括号写在函数名后面，里面声明的名字是类型参数。声明之后，它可以出现在参数类型里、返回类型里、函数体里。类型参数不是运行期的东西：编译器看到一个泛型函数被用在几个类型上，就为每个类型各生成一份代码，把参数换成具体类型。这个过程叫单态化(monomorphization)。

> [!marginnote] 与类型擦除的对照
> Java 的泛型在编译后抹掉类型参数，一份字节码服务所有实例化。Rust 走另一条路，为每个用到的类型各铺一份机器码。前者省代码体积，后者省运行期的间接调用。

同一段源码服务多个类型，这件事叫多态(polymorphism)。靠类型参数得到的这一种叫参数多态(parametric polymorphism)，函数体对具体类型一无所知。单态化是参数多态的一种实现路子，另一种路子是动态分发，dyn Trait 那一节讲。

下面这段既演示单态化，也演示一个反直觉的地方：

```rust
use std::any::type_name;
use std::mem::size_of;
use std::sync::atomic::{AtomicUsize, Ordering};

// 一段源码，靠 T 参数化
fn describe<T>() -> (&'static str, usize) {
    (type_name::<T>(), size_of::<T>())
}

// 泛型函数体内的 static：每个实例化各有一份，还是共用一份？
fn bump<T>() -> usize {
    static N: AtomicUsize = AtomicUsize::new(0);
    N.fetch_add(1, Ordering::SeqCst)
}

fn main() {
    // 同一段源码，三个实例化，返回值各不相同
    assert_eq!(describe::<u8>(), ("u8", 1));
    assert_eq!(describe::<u64>(), ("u64", 8));
    assert_eq!(describe::<[u32; 3]>(), ("[u32; 3]", 12));

    // 计数器只有一份，三次调用连着计
    assert_eq!(bump::<u8>(), 0);
    assert_eq!(bump::<u8>(), 1);
    assert_eq!(bump::<u64>(), 2);

    println!(
        "u8:{:?} u64:{:?} next={}",
        describe::<u8>(),
        describe::<u64>(),
        bump::<String>()
    );
}
```

运行输出如下，六组断言全部通过：

```text
u8:("u8", 1) u64:("u64", 8) next=3
```

前三组断言给出三个不同的答案，源码却只有一份。类型名与字节宽度都是编译期就定下来的，写在同一个函数体里，靠 `T` 取到不同的值。

后三组断言是那个反直觉的地方。既然每个类型各铺一份代码，函数体里那个计数器是不是也各有一份？断言说不是：两次用 `u8` 调用返回 0 和 1，紧接着换成 `u64` 返回 2，计数跨类型连着走。原因是函数体内声明的嵌套 item 不继承外层函数的类型参数——那个静态变量不属于任何一份实例化，整个程序里只有一个。这个结果在开优化与不开优化、edition 2021 与 2024 四种组合下一致。

单态化铺了几份代码可以直接数出来，讲动态分发时给出计数。

## trait bound 的三种写法

trait 是一组方法签名的名字(还可以带关联类型和关联常量，关联类型那一节展开)，一个类型通过 impl 块提供这组内容。约束(bound)是对类型参数提要求：「`T` 得是实现了 `Display` 的类型」。同一条要求有三种写法。

```rust
use std::fmt::Display;

// 写法一：尖括号里直接写约束
fn show_a<T: Display>(x: T) -> String {
    format!("{}", x)
}

// 写法二：where 子句
fn show_b<T>(x: T) -> String
where
    T: Display,
{
    format!("{}", x)
}

// 写法三：参数位的 impl Trait
fn show_c(x: impl Display) -> String {
    format!("{}", x)
}

// 多条约束：加号串联
fn show_d<T: Display + Clone>(x: T) -> String {
    let y = x.clone();
    format!("{} {}", x, y)
}

fn main() {
    assert_eq!(show_a(42), "42");
    assert_eq!(show_b(42), "42");
    assert_eq!(show_c(42), "42");
    assert_eq!(show_a("hi"), "hi");
    assert_eq!(show_d(7), "7 7");

    // 前两种写法可以 turbofish 指定类型参数
    assert_eq!(show_a::<i32>(42), "42");
    assert_eq!(show_b::<i32>(42), "42");

    println!("a={} b={} c={} d={}", show_a(42), show_b(42), show_c(42), show_d(7));
}
```

运行输出 `a=42 b=42 c=42 d=7 7`。三种写法在调用侧给出同一结果，`show_d` 里的加号说明多条约束怎么串。

三种写法不完全等价。前两种给类型参数起了名字，调用处可以手工指定它，末尾两组断言就是这么做的；第三种没有名字，指定不了。

> [!marginnote] turbofish 这个名字
> 那串尖括号加冒号的写法因为形状像一条带鳍的鱼而得名，Rust 社区一直这么叫。它的用处是在编译器推不出类型参数时手工把类型填进去。

把 `show_c` 也照这个样子调用，编译器直接说这个函数没有类型参数：

```text
error[E0107]: function takes 0 generic arguments but 1 generic argument was supplied
  |     let s = show_c::<i32>(42);
  |             ^^^^^^------- help: remove the unnecessary generics
  |             |
  |             expected 0 generic arguments
  |
  = note: `impl Trait` cannot be explicitly specified as a generic argument
```

`where` 子句还能表达尖括号写不了的一类约束：约束的左边不是所声明的那个类型参数本身。尖括号里冒号左边只能填类型参数的名字，左边换成别的东西就没有位置写。

```rust
use std::fmt::Debug;

// 约束的左边是一个容器类型，不是类型参数本身：尖括号里没有位置写它
fn dump_pairs<T>(v: Vec<T>) -> String
where
    Vec<T>: Debug,
{
    format!("{:?}", v)
}

// 左边是 &'a T，同样只能写在 where 里；for<'a> 读作对任意生命周期都成立
fn count_all<T>(x: &T) -> usize
where
    for<'a> &'a T: IntoIterator,
{
    x.into_iter().count()
}

// for<'a> 加在类型参数本身上时，写进尖括号也合法，这里用 where 只是为了排版
fn apply_to_all<F>(f: F, xs: &[String]) -> Vec<usize>
where
    F: for<'a> Fn(&'a str) -> usize,
{
    xs.iter().map(|s| f(s)).collect()
}

fn main() {
    let xs = vec![String::from("ab"), String::from("cde")];
    assert_eq!(dump_pairs(vec![1, 2, 3]), "[1, 2, 3]");
    assert_eq!(count_all(&vec![10, 20, 30]), 3);
    assert_eq!(apply_to_all(|s: &str| s.len(), &xs), vec![2, 3]);

    // 同一条高阶生命周期约束换成尖括号写法，行为一致
    fn apply_to_all_angle<F: for<'a> Fn(&'a str) -> usize>(f: F, xs: &[String]) -> Vec<usize> {
        xs.iter().map(|s| f(s)).collect()
    }
    assert_eq!(apply_to_all_angle(|s: &str| s.len(), &xs), vec![2, 3]);

    println!(
        "{} {} {:?}",
        dump_pairs(vec![1, 2, 3]),
        count_all(&vec![10, 20, 30]),
        apply_to_all(|s: &str| s.len(), &xs)
    );
}
```

运行输出 `[1, 2, 3] 3 [2, 3]`。`dump_pairs` 那条约束的左边是一个容器类型，`count_all` 那条的左边是一个引用类型，两条的左边都不是 `T` 本身，尖括号里写不下。

以 for 开头的那段叫高阶生命周期约束(higher-ranked trait bound)，读作「对任意生命周期都成立」：它要求 `f` 换上哪一个生命周期都能用，而不是只对某一个特定的生命周期成立。这段记号写在哪里由左边决定，与它本身无关——`count_all` 的左边是 `&'a T`，只能进 `where`；`apply_to_all` 的左边是类型参数 `F`，尖括号里也写得下，末尾那个 `apply_to_all_angle` 给出的就是尖括号版本，两版断言相同。

三种写法怎么选：约束短就写尖括号，约束多或者形状复杂就写 `where`，参数类型在别处用不到就写 `impl Trait`。

## impl Trait 在返回位是另一回事

参数位的 `impl Display` 是说「调用方可以传任何实现了 `Display` 的类型」。返回位的 `impl Display` 方向反过来：「被调用方挑定了某一个具体类型，调用方看不见是哪个」。

```rust
// 返回位 impl Trait：被调用方挑定一个类型，调用方看不见是哪个
fn zero_opaque() -> impl std::fmt::Debug {
    0i32
}

// 泛型返回：调用方挑类型
fn zero_generic<T: Default + std::fmt::Debug>() -> T {
    T::default()
}

fn main() {
    assert_eq!(format!("{:?}", zero_opaque()), "0");

    let a: i32 = zero_generic();
    let b: String = zero_generic();
    let c: Vec<u8> = zero_generic();
    assert_eq!(a, 0);
    assert_eq!(b, "");
    assert_eq!(c, Vec::<u8>::new());

    println!("{:?} {} {:?} {:?}", zero_opaque(), a, b, c);
}
```

运行输出如下，四个值依次是不透明返回值与三个泛型返回值：

```text
0 0 "" []
```

两个函数的签名读起来像同一句话「返回一个实现了 Debug 的东西」，谁挑那个类型却相反。`zero_opaque` 由函数体挑定，调用处拿到的一直是同一个类型；`zero_generic` 由调用处挑，三行分别拿到 `i32`、`String`、`Vec<u8>`。

返回位藏起来的那个类型叫不透明类型(opaque type)。藏起来有两条后果：调用方拿不到具体类型；约束里没写的方法用不了。把两条都触发一遍——第一条给 `zero_opaque()` 的结果标注成 `i32`；第二条另写一个返回 `impl Iterator<Item = u32>` 的函数 `nums`，函数体是一个 `map` 适配器，再调用 `nums().len()`——编译器的用词就是 opaque type：

```text
error[E0308]: mismatched types
   | fn zero_opaque() -> impl std::fmt::Debug {
   |                     -------------------- the found opaque type
   |     let a: i32 = zero_opaque();
   |            ---   ^^^^^^^^^^^^^ expected `i32`, found opaque type
   |
   = note:     expected type `i32`
           found opaque type `impl Debug`

error[E0599]: no method named `len` found for opaque type `impl Iterator<Item = u32>` in the current scope
   |     let n = nums().len();
   |                    ^^^
```

第二条错误的来由是：`impl Iterator<Item = u32>` 只承诺了 `Iterator`，取长度的那个方法属于 `ExactSizeIterator`，不在承诺范围内。

既然限制这么多，返回位的 `impl Trait` 有什么用？闭包类型没有名字，写不进签名，返回闭包时只能靠它：

```rust
use std::any::type_name_of_val;

// 返回位的 impl Trait：只承诺「某一个固定类型实现了 Fn」，不承诺是哪一个
fn adder(k: i32) -> impl Fn(i32) -> i32 {
    move |x| x + k
}

// 换成 Box<dyn Fn> 之后，两个分支可以是两个不同的闭包类型
fn pick(double: bool, k: i32) -> Box<dyn Fn(i32) -> i32> {
    if double {
        Box::new(move |x| x * k)
    } else {
        Box::new(move |x| x + k)
    }
}

fn main() {
    let f = adder(1);
    let g = adder(100);
    assert_eq!(f(41), 42);
    assert_eq!(g(41), 141);
    // 两次调用返回的是同一个具体类型
    assert_eq!(type_name_of_val(&f), type_name_of_val(&g));

    assert_eq!(pick(true, 2)(21), 42);
    assert_eq!(pick(false, 1)(21), 22);

    println!(
        "f(41)={} g(41)={} same_type={} pick={} {}",
        f(41),
        g(41),
        type_name_of_val(&f) == type_name_of_val(&g),
        pick(true, 2)(21),
        pick(false, 1)(21)
    );
}
```

运行输出 `f(41)=42 g(41)=141 same_type=true pick=42 22`。`adder(1)` 与 `adder(100)` 捕获的值不同，类型相同——那条比较类型名的断言核对了这一点。`pick` 的两个分支各自捕获了 `k`，是两个不同的闭包类型，`impl Trait` 在这里不够用，得换成 `Box<dyn Fn(i32) -> i32>`。把 `pick` 的返回类型改回 `impl Fn(i32) -> i32` 再去掉两处装箱，编译器报 E0308，说 if 与 else 的类型对不上。分支不捕获环境时这条限制绕得过去，「记号会骗人的几处」第一处给出实测。`Box` 凭什么能装下两个类型，下一节讲。

## dyn Trait 与动态分发

`dyn Trait` 是 trait 对象：它不说具体类型是什么，只保证这东西实现了这个 trait。同一份代码在运行期可以接到不同的具体类型。

```rust
use std::f64::consts::PI;
use std::fmt::Display;
use std::mem::size_of;

trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> &'static str;
}

struct Square(f64);
struct Circle(f64);

impl Shape for Square {
    fn area(&self) -> f64 {
        self.0 * self.0
    }
    fn name(&self) -> &'static str {
        "square"
    }
}

impl Shape for Circle {
    fn area(&self) -> f64 {
        PI * self.0 * self.0
    }
    fn name(&self) -> &'static str {
        "circle"
    }
}

// 静态分发：单态化出两份，每份直接调用
fn area_static<S: Shape>(s: &S) -> f64 {
    s.area()
}

// 动态分发：一份代码，运行期查虚表
fn area_dyn(s: &dyn Shape) -> f64 {
    s.area()
}

fn main() {
    let sq = Square(2.0);
    let ci = Circle(2.0);

    assert_eq!(area_static(&sq), 4.0);
    assert_eq!(area_dyn(&sq), 4.0);
    assert!((area_static(&ci) - PI * 4.0).abs() < 1e-12);
    assert!((area_dyn(&ci) - PI * 4.0).abs() < 1e-12);

    // 装不同具体类型的同一个 Vec，必须走 trait 对象
    let shapes: Vec<Box<dyn Shape>> = vec![Box::new(Square(1.0)), Box::new(Circle(1.0))];
    let total: f64 = shapes.iter().map(|s| s.area()).sum();
    assert!((total - (1.0 + PI)).abs() < 1e-12);
    let names: Vec<&str> = shapes.iter().map(|s| s.name()).collect();
    assert_eq!(names, vec!["square", "circle"]);

    // 胖指针：&dyn Shape 占两个字长，&Square 占一个
    assert_eq!(size_of::<&Square>(), size_of::<usize>());
    assert_eq!(size_of::<&dyn Shape>(), 2 * size_of::<usize>());

    // dyn Iterator 要把关联类型钉死
    let it: Box<dyn Iterator<Item = u32>> = Box::new((1..4).map(|x| x * 10));
    let v: Vec<u32> = it.collect();
    assert_eq!(v, vec![10, 20, 30]);

    // Display 可以做 trait 对象
    let items: Vec<Box<dyn Display>> = vec![Box::new(1), Box::new("two"), Box::new(3.5)];
    let joined: Vec<String> = items.iter().map(|d| d.to_string()).collect();
    assert_eq!(joined, vec!["1", "two", "3.5"]);

    println!(
        "total={:.6} names={:?} sizes={}/{} v={:?} joined={:?}",
        total,
        names,
        size_of::<&Square>(),
        size_of::<&dyn Shape>(),
        v,
        joined
    );
}
```

在 64 位平台运行，输出：

```text
total=4.141593 names=["square", "circle"] sizes=8/16 v=[10, 20, 30] joined=["1", "two", "3.5"]
```

`area_static` 与 `area_dyn` 的函数体一模一样，签名的读法不同。前者是泛型：`S` 在编译期定下来，编译器为 `Square` 与 `Circle` 各铺一份代码，调用是直接调用。后者收一个 trait 对象：一份代码，调用时从虚表里查出地址再跳过去。

量尺寸那两组断言给出直接的证据。`&dyn Shape` 占两个字长，`&Square` 占一个，多出来的那一个字长放虚表(vtable)指针。这种带两个字长的引用叫胖指针(fat pointer)。上面打印出的 8 与 16 取自 64 位平台，换到 32 位目标是 4 与 8，所以断言写成与字长的比例，不写死字节数。

`Vec<Box<dyn Shape>>` 那一段是 trait 对象非出场不可的地方。`Vec` 要求元素同类型，`Square` 与 `Circle` 不同类型，写不成一个具体的 `Vec`；换成 trait 对象，两者在类型上就统一了。代价是每个元素多一次堆分配，每次方法调用多一次查表。

装迭代器那一行还演示了一个细节：`Iterator` 带关联类型，做成 trait 对象时要把关联类型钉死，写成等号绑定的形式。关联类型下一节讲。

单态化铺了几份代码，可以数符号。把一个泛型函数用在 5 个类型上，再写一个动态分发版本作对照：

```rust
use std::fmt::Debug;

#[inline(never)]
fn dump_static<T: Debug>(x: T) -> String {
    format!("{:?}", x)
}

#[inline(never)]
fn dump_dyn(x: &dyn Debug) -> String {
    format!("{:?}", x)
}

fn main() {
    let s = [
        dump_static(1u8),
        dump_static(2u16),
        dump_static(3u32),
        dump_static(4u64),
        dump_static('x'),
        dump_dyn(&1u8),
        dump_dyn(&2u16),
        dump_dyn(&3u32),
        dump_dyn(&4u64),
        dump_dyn(&'x'),
    ];
    println!("{}", s.join(","));
}
```

程序输出如下，两条路径给出同样的字符串：

```text
1,2,3,4,'x',1,2,3,4,'x'
```

编译成目标文件之后数符号：

```text
$ rustc -O --emit=obj -o codegen.o codegen.rs
$ nm codegen.o | grep -c dump_static
5
$ nm codegen.o | grep -c dump_dyn
1
```

5 个类型对应 5 份代码，动态分发版本只有 1 份。这是两种分发的代价对照：静态分发换来直接调用与内联的机会，代码体积按用到的类型数增长；动态分发换来一份代码，每次调用过一次指针。

不是每个 trait 都能做成 trait 对象。方法签名里把 `Self` 当返回类型的，就不行：

```text
error[E0038]: the trait `Doubler` is not dyn compatible
   | fn call(x: &dyn Doubler) -> i32 {
   |             ^^^^^^^^^^^ `Doubler` is not dyn compatible
   |
note: for a trait to be dyn compatible it needs to allow building a vtable
   |     fn twice(&self) -> Self;
   |                        ^^^^ ...because method `twice` references the `Self` type in its return type
```

这条限制过去叫对象安全(object safety)，rustc 1.97.1 的措辞是 dyn 兼容性(dyn compatibility)。规则本身没变：要能建虚表，方法就不能在签名里提到那个还没定下来的 `Self`。

## 关联类型与泛型参数

trait 可以带类型。两种带法：关联类型写在 trait 体内，泛型参数写在 trait 名后面的尖括号里。差别在数量——关联类型对每个实现者只能挑一个，泛型参数允许同一个实现者挑多个。

```rust
// 关联类型：一个类型只能挑一个 Out
trait Producer {
    type Out;
    fn produce(&self) -> Self::Out;
}

struct Meter(i32);

impl Producer for Meter {
    type Out = i32;
    fn produce(&self) -> i32 {
        self.0
    }
}

// 泛型参数：同一个类型可以实现多次，每次挑一个 T
trait Into2<T> {
    fn conv(&self) -> T;
}

impl Into2<i32> for Meter {
    fn conv(&self) -> i32 {
        self.0
    }
}

impl Into2<String> for Meter {
    fn conv(&self) -> String {
        format!("{}m", self.0)
    }
}

fn main() {
    let m = Meter(3);

    // 关联类型：调用处不用写类型，编译器查表得到 i32
    let a = m.produce();
    assert_eq!(a, 3);

    // 泛型参数：同一个方法名有两个候选，调用处必须指明
    let b: i32 = m.conv();
    let c: String = m.conv();
    assert_eq!(b, 3);
    assert_eq!(c, "3m");

    // 也可以 turbofish
    assert_eq!(Into2::<String>::conv(&m), "3m");

    // 自定义迭代器：Item 是关联类型，写在尖括号里用等号绑定
    struct Countdown(u32);
    impl Iterator for Countdown {
        type Item = u32;
        fn next(&mut self) -> Option<u32> {
            if self.0 == 0 {
                None
            } else {
                self.0 -= 1;
                Some(self.0)
            }
        }
    }

    let v: Vec<u32> = Countdown(4).collect();
    assert_eq!(v, vec![3, 2, 1, 0]);

    // 约束「Item 是什么」用 Iterator<Item = u32> 这种等号写法
    fn total(it: impl Iterator<Item = u32>) -> u32 {
        it.sum()
    }
    assert_eq!(total(Countdown(4)), 6);

    println!("a={} b={} c={} v={:?} total={}", a, b, c, v, total(Countdown(4)));
}
```

运行输出 `a=3 b=3 c=3m v=[3, 2, 1, 0] total=6`。

关联类型这一侧：`Meter` 实现 `Producer` 时把 `Out` 定成了 `i32`，调用处写一句 `m.produce()` 就够，编译器查一次表就知道结果是 `i32`。

泛型参数这一侧：`Meter` 实现了两次 `Into2`，一次取 `i32`，一次取 `String`。调用处 `m.conv()` 有两个候选，得靠绑定上的类型标注或者 turbofish 指明选哪一个。

两者换不得。想让关联类型也支持「一个类型出两种结果」，就要写两个 impl，编译器拦下：

```text
error[E0119]: conflicting implementations of trait `Producer` for type `Meter`
   | impl Producer for Meter {
   | ----------------------- first implementation here
...
   | impl Producer for Meter {
   | ^^^^^^^^^^^^^^^^^^^^^^^ conflicting implementation for `Meter`
```

`Iterator` 用关联类型而不是泛型参数，理由就在这里：一个迭代器类型产出什么元素是定死的，写成关联类型，下游每一次取元素都不用标注。要约束元素类型是什么，写成等号绑定，也就是代码里那个 `total` 的参数写法。

## 闭包三档在签名里怎么读

闭包记号 `|x| x + 1` 造出来的东西有一个编译器生成的匿名类型，名字写不出来，只能通过它实现的 trait 来指称。三个 trait 对应三档：`Fn` 可以反复调用，`FnMut` 调用时会改捕获的东西，`FnOnce` 调用一次就把自己消耗掉。

签名里的读法：`impl Fn(i32) -> i32` 读作「一个能反复调用、吃 `i32` 吐 `i32` 的东西」。圆括号里是参数类型列表，箭头后面是返回类型。

```rust
// 三档在签名里的读法：括号里是参数类型，箭头后是返回类型
fn apply_fn(f: impl Fn(i32) -> i32, x: i32) -> i32 {
    // Fn：只借用捕获的东西，可以反复调用
    f(x) + f(x)
}

fn apply_mut(mut f: impl FnMut(i32), xs: &[i32]) {
    // FnMut：调用时可以改捕获的东西，所以要 mut 绑定
    for &x in xs {
        f(x);
    }
}

fn apply_once<T>(f: impl FnOnce() -> T) -> T {
    // FnOnce：调用一次就把闭包消耗掉
    f()
}

fn main() {
    let k = 10;
    assert_eq!(apply_fn(|x| x + k, 1), 22);

    let mut seen = Vec::new();
    apply_mut(|x| seen.push(x), &[1, 2, 3]);
    assert_eq!(seen, vec![1, 2, 3]);

    let owned = String::from("gone");
    assert_eq!(apply_once(move || owned), "gone");

    // 不捕获的闭包可以强转成函数指针，函数指针又实现了三档全部
    let p: fn(i32) -> i32 = |x| x * 2;
    assert_eq!(apply_fn(p, 3), 12);

    // 普通函数项同样实现 Fn
    fn triple(x: i32) -> i32 {
        x * 3
    }
    assert_eq!(apply_fn(triple, 2), 12);

    println!("ok: {} {:?} {}", apply_fn(|x| x + k, 1), seen, apply_fn(p, 3));
}
```

运行输出 `ok: 22 [1, 2, 3] 12`。

三个函数的签名差别落在两处。`apply_mut` 的参数写成 `mut f`，因为调用一个 `FnMut` 需要可变借用；`apply_once` 不需要 `mut`，因为它把闭包整个消耗掉，签名里的按值传参已经说明了这件事。

末尾两组断言说明 `impl Fn` 收的不只是闭包。不捕获环境的闭包能强转成函数指针，函数指针实现了三档；普通函数项也实现了三档。所以传一个具名函数进去，签名照样对得上。

三档之间是包含关系：实现了 `Fn` 的东西也满足 `FnMut` 的要求，满足 `FnMut` 的也满足 `FnOnce` 的要求，反过来不成立。所以读签名时，档位越靠近 `FnOnce`，这个参数位收得越宽。这个关系落到组合链上会有连带后果，[Rust 中的函数组合](../categories/composition-in-rust/) 有实测，本篇不重复。

## 生命周期标注怎么读

生命周期参数写成一个撇号加一个名字，下面代码里那个叫 a。它的读法与类型参数一样：先在尖括号里声明，再在签名里使用。它指代一段代码区域；写在签名里时它是一个待定的参数，编译器在每个调用点把它解成满足全部约束的那一段，被它标注的那些引用之间因此要满足某种存活关系。

```rust
// 读法：'a 是一个参数，像 T 一样先声明再使用。
// 这条签名说：返回的引用，活得不比 x 和 y 里短命的那个更久。
fn longer<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() >= y.len() { x } else { y }
}

// 只有一个输入引用时，省略规则替你补上 'a，两条签名等价
fn head_elided(s: &str) -> &str {
    s.split(' ').next().unwrap_or("")
}

fn head_explicit<'a>(s: &'a str) -> &'a str {
    s.split(' ').next().unwrap_or("")
}

// 生命周期与类型参数并列声明，'a 写在前面
fn first_of<'a, T>(v: &'a [T]) -> Option<&'a T> {
    v.first()
}

// 返回位的 impl Trait 里，+ 'a 说明这个不透明类型可以持有 'a 的借用
fn upper_of<'a>(s: &'a str) -> impl Iterator<Item = char> + 'a {
    s.chars().flat_map(|c| c.to_uppercase())
}

fn main() {
    let a = String::from("category");
    let b = String::from("id");
    assert_eq!(longer(&a, &b), "category");

    assert_eq!(head_elided("hello world"), "hello");
    assert_eq!(head_explicit("hello world"), "hello");

    let v = vec![7, 8, 9];
    assert_eq!(first_of(&v), Some(&7));

    let s = String::from("abc");
    let up: String = upper_of(&s).collect();
    assert_eq!(up, "ABC");

    println!("{} {} {:?} {}", longer(&a, &b), head_elided("hello world"), first_of(&v), up);
}
```

运行输出 `category hello Some(7) ABC`。

`longer` 的签名说：两个入参和返回值共用同一个生命周期参数。这不是要求两个入参活得一样久，而是让这个参数取成两者里较短的那一段，返回的引用不能超出这一段。

`head_elided` 与 `head_explicit` 的函数体一字不差，签名一个带标注一个不带。只有一个输入引用时，编译器把返回引用的生命周期接到这个输入上，这条规则叫生命周期省略(lifetime elision)。

> [!marginnote] 省略规则省的是书写
> 生命周期省略让人少写几个字母，不改变签名的含义。省略前后是同一条签名，可以互相替换。看不出编译器会怎么补的时候，手写一遍标注就能确认。

`first_of` 演示声明顺序：生命周期参数与类型参数并列时，生命周期写在前面。

`upper_of` 演示返回位的叠加写法。它的返回类型是两条承诺摞在一起：藏起来的那个类型实现了 `Iterator`，而且它可以持有入参那段借用。加号后面那个生命周期参数就是后半条承诺。这条标注在哪个 edition 下必需，实测分两种情况：edition 2015 与 2021 缺了它报 E0700，说藏起来的类型捕获了一个没写进 bound 的生命周期，并提示补 `+ use<'a>`；edition 2024 起返回位的 `impl Trait` 默认捕获作用域内的生命周期参数，同一段代码不加标注也能编译，运行输出仍是 ABC。上面那段带 `+ 'a` 的写法在 2015、2021、2024 三个 edition 下都能编译，断言一致。

组合链上的生命周期怎么走，[Rust 中的函数组合](../categories/composition-in-rust/) 有一节专讲，本篇只到读法为止。

## 记号会骗人的几处

第一处，「返回位 `impl Trait` 时两个分支返回不同的闭包会失败」——这句话少一个前提。两个分支都不捕获环境时，它们各自强转成函数指针，转完是同一个类型，编译通过：

```rust
use std::any::type_name_of_val;

// 两个分支都是不捕获环境的闭包，被统一强转成函数指针类型
fn pick(double: bool) -> impl Fn(i32) -> i32 {
    if double {
        |x| x * 2
    } else {
        |x| x + 1
    }
}

fn main() {
    assert_eq!(pick(true)(21), 42);
    assert_eq!(pick(false)(21), 22);
    println!("type = {}", type_name_of_val(&pick(true)));
}
```

运行输出 `type = fn(i32) -> i32`。返回的不是闭包类型，是函数指针类型——两个分支在这里被拉到了同一个类型上。这个强转机制 [恒等态射](../categories/identity-morphism/) 的题 2 用过，那里是显式写出函数指针类型，这里是编译器自己推出来的。

把「impl Trait 在返回位是另一回事」那一节里带 `k` 的 `pick` 拿过来，返回类型改成 `impl Fn(i32) -> i32`，两个分支各捕获 `k`，强转不再可能，这时才失败：

```text
error[E0308]: `if` and `else` have incompatible types
  |         move |x| x * k
  |         -------------- the expected closure
  |         move |x| x + k
  |         ^^^^^^^^^^^^^^ expected closure, found a different closure
  |
  = note: no two closures, even if identical, have the same type
  = help: consider boxing your closure and/or using it as a trait object
```

准确的说法是：返回位的 `impl Trait` 承诺某一个具体类型，两个分支给出不同的具体类型才失败；不捕获环境的闭包先被统一成函数指针，绕过了这条限制。判断标准不是「是不是两个闭包」，是「转完之后还是不是两个类型」。

第二处，`impl Trait` 只能出现在函数与方法的参数位和返回位，写在别处会被拦下。嵌套在另一个 `impl Trait` 里，一次报两条：

```text
error[E0666]: nested `impl Trait` is not allowed
  | fn call_with(g: impl Fn(impl Display) -> String) -> String {
  |                 --------^^^^^^^^^^^^-----------
  |                 |       |
  |                 |       nested `impl Trait` here
  |                 outer `impl Trait`

error[E0562]: `impl Trait` is not allowed in the parameters of `Fn` trait bounds
  = note: `impl Trait` is only allowed in arguments and return types of functions and methods
```

写在 `let` 绑定的类型上，同样不行：

```text
error[E0562]: `impl Trait` is not allowed in the type of variable bindings
  |     let f: impl Fn(i32) -> i32 = |x| x + 1;
  |            ^^^^^^^^^^^^^^^^^^^
  |
  = note: `impl Trait` is only allowed in arguments and return types of functions and methods
  = note: see issue #63065 <https://github.com/rust-lang/rust/issues/63065> for more information
```

想给一个闭包绑定写类型标注，路子有三条：函数指针类型、`Box<dyn Fn(i32) -> i32>`、或者不标注让编译器推。

第三处，同一个 `impl Trait` 记号在两个位置的方向相反。它在参数列表里，是调用方挑类型；它在箭头右边，是被调用方挑类型。读签名时先看它站在哪一边，再读它承诺了什么。

第四处，关联类型与泛型参数看着都是「trait 带一个类型」。判断依据是数量：一个实现者对这个 trait 只出一种类型，用关联类型；要出多种，用泛型参数。关联类型那一节的 E0119 就是选错之后的样子。

第五处，搜索错误信息时的术语差。trait 对象的限制过去叫 object safety，rustc 1.97.1 的错误信息里写的是 not dyn compatible。按旧词搜当前的错误信息会搜不到。

## 练习

### 题 1

把 [范畴](../categories/category/) 里那个 `compose` 的三处 `impl Trait` 改写成具名类型参数加 `where` 子句。哪一处改不了？为什么？

解：参数位的两处能改，返回位那处改不了。返回类型是函数体里那个闭包的类型，编译器生成，名字写不出来，只能留 `impl Trait`。

```rust
// 原版：三处 impl Trait
fn compose_impl<A, B, C>(f: impl Fn(A) -> B, g: impl Fn(B) -> C) -> impl Fn(A) -> C {
    move |x| g(f(x))
}

// 改写：参数位换成具名类型参数 + where 子句；返回位只能留 impl Trait
fn compose_where<A, B, C, F, G>(f: F, g: G) -> impl Fn(A) -> C
where
    F: Fn(A) -> B,
    G: Fn(B) -> C,
{
    move |x| g(f(x))
}

fn main() {
    let add1 = |x: i32| x + 1;
    let show = |x: i32| format!("<{}>", x);

    assert_eq!(compose_impl(add1, show)(41), "<42>");
    assert_eq!(compose_where(add1, show)(41), "<42>");

    // 具名版本可以 turbofish 指定全部类型参数
    let h = compose_where::<i32, i32, String, _, _>(add1, show);
    assert_eq!(h(41), "<42>");

    println!("{} {} {}", compose_impl(add1, show)(41), compose_where(add1, show)(41), h(41));
}
```

运行输出 `<42> <42> <42>`，两版行为一致。

改写的收益在末尾那两行：两个闭包参数有了名字，调用处可以把类型参数手工填进去，原版做不到。代价是签名从一行变成五行，而 `F` 与 `G` 这两个名字在函数体里一次也没用到。参数只用一次的时候，`impl Trait` 写法更短。

### 题 2

同一件事分别用关联类型和泛型参数建模，对比两种写法在调用处的差别。

解：

```rust
// 关联类型版：Words 只能有一个 Out，调用处不用标注
trait CountA {
    type Out;
    fn count(&self) -> Self::Out;
}

// 泛型参数版：同一个类型可以实现多次，调用处必须标注
trait CountG<T> {
    fn count(&self) -> T;
}

struct Words(&'static str);

impl CountA for Words {
    type Out = usize;
    fn count(&self) -> usize {
        self.0.split_whitespace().count()
    }
}

impl CountG<usize> for Words {
    fn count(&self) -> usize {
        self.0.split_whitespace().count()
    }
}

impl CountG<String> for Words {
    fn count(&self) -> String {
        format!("{} words", self.0.split_whitespace().count())
    }
}

fn main() {
    let w = Words("a b c");

    // 关联类型：无需标注
    assert_eq!(CountA::count(&w), 3);

    // 泛型参数：必须标注，否则编译器不知道选哪个实现
    let n: usize = CountG::count(&w);
    let s: String = CountG::count(&w);
    assert_eq!(n, 3);
    assert_eq!(s, "3 words");

    println!("{} {} {}", CountA::count(&w), n, s);
}
```

运行输出 `3 3 3 words`。

关联类型版的调用处什么都不用写，因为 `Words` 只配一个 `Out`。泛型参数版有两个实现，调用处得给类型标注。把那两行绑定上的类型标注去掉，编译器报的是 E0283，并把两个候选实现都列出来：

```text
error[E0283]: type annotations needed
   |     let n = CountG::count(&w);
   |         ^   ------------- -- type must be known at this point
   |
note: multiple `impl`s satisfying `Words: CountG<_>` found
   | impl CountG<usize> for Words {
   | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
...
   | impl CountG<String> for Words {
   | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

这条错误把两种建模的差别说得很直接：泛型参数把「选哪个实现」这个决定推给了调用处。

### 题 3

照标准库 `Iterator` 的 map 签名重写一个 map 适配器，把关联类型、`where` 子句、`FnMut` 三处记号逐块对号。

解：

```rust
// 照着标准库 Iterator::map 的签名重写一遍，逐块对号
struct MyMap<I, F> {
    it: I,
    f: F,
}

impl<I, F, B> Iterator for MyMap<I, F>
where
    I: Iterator,
    F: FnMut(I::Item) -> B,
{
    type Item = B;
    fn next(&mut self) -> Option<B> {
        self.it.next().map(&mut self.f)
    }
}

trait MyMapExt: Iterator {
    fn my_map<B, F>(self, f: F) -> MyMap<Self, F>
    where
        Self: Sized,
        F: FnMut(Self::Item) -> B,
    {
        MyMap { it: self, f }
    }
}

impl<I: Iterator> MyMapExt for I {}

fn main() {
    let v: Vec<String> = vec![1, 2, 3].into_iter().my_map(|x| format!("#{}", x)).collect();
    assert_eq!(v, vec!["#1", "#2", "#3"]);

    // FnMut 而非 Fn：闭包可以改捕获的东西
    let mut calls = 0;
    let w: Vec<i32> = vec![10, 20]
        .into_iter()
        .my_map(|x| {
            calls += 1;
            x + 1
        })
        .collect();
    assert_eq!(w, vec![11, 21]);
    assert_eq!(calls, 2);

    println!("{:?} {:?} calls={}", v, w, calls);
}
```

运行输出：

```text
["#1", "#2", "#3"] [11, 21] calls=2
```

逐块对号。`MyMap<I, F>` 的两个类型参数分别是被包住的迭代器与那个函数。`B` 只在 `where` 子句和 `type Item = B` 上露面，它由 `F` 的返回类型定下来，调用处不用写。`F` 的参数类型不是一个独立的类型参数，而是取自被包住那个迭代器的关联类型，所以换一个迭代器，这条约束跟着变。约束一律写在 `where` 里而不是尖括号里，因为它们的形状放进尖括号会挤。

约束选 `FnMut` 而不是 `Fn`，是为了让传进来的闭包能改捕获的东西——后半段那个计数器闭包每调用一次给 `calls` 加一，断言核对它等于 2。把两处约束都改成 `Fn` 再编译，那个闭包就传不进去，报 E0594 说不能给捕获的变量赋值。改成 `FnOnce` 也不行：`next` 里那句要反复调用 `f`，报 E0277，note 的原话是 F implements FnOnce, but it must implement FnMut, which is more general。这里的 general 是编译器的措辞，说的是一个实现了 `FnMut` 的闭包用起来受的限制更少。本篇「闭包三档在签名里怎么读」一节说的「档位越靠近 `FnOnce`，这个参数位收得越宽」讲的是另一件事——参数位能接受的实参范围。两句话的主语不同，方向相反不构成矛盾。三档之中 `FnMut` 是这里够用的那一档。

## 相关词条

- [Rust 中的函数组合](../categories/composition-in-rust/) — 闭包三档在组合链里怎么传染、类型推断从哪里找线索
- [范畴](../categories/category/) — 本篇拆的那个组合函数的出处
- [恒等态射](../categories/identity-morphism/) — 参数多态的例子；非捕获闭包强转成函数指针
- [组合是编程的本质](../categories/what-is-composition/) — 签名是表面积，以及签名相同不一定能互换
- [Haskell 记号速读](../notation/haskell-notation/) — 同一批约束在 Haskell 里写成类型类
- [集合与函数](../notation/sets-and-functions/) — 记号地基的第一篇，函数签名的读法
- [类型即集合](../types-and-functions/types-as-sets/) — 泛型与生命周期在集合模型里的位置
- [Rust 里的高阶类型](../functors/hkt-in-rust/) — trait 加关联类型能把高阶类型模拟到什么程度
- [参数性](../natural-transformations/parametricity/) — 泛型签名能反推出多少行为
- [函子](../functors/functor/) — 用 trait 加关联类型表达函子时撞上的限制
