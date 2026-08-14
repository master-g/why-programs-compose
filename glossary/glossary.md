---
title: 词汇表:术语译法与约定
---

本页汇总全库术语的译法约定:哪些翻译、哪些保留英文、首次出现如何对照。写词条时遇到新的术语决策,随手在本页加一行;查阅时按分组找。「首现」指该术语第一次出现的词条;词条未毕业时先写 slug 纯文本,毕业后改成链接。

译法沿承 vault `03 - AREAS/learning/category-theory/` 旧译项目的词汇表(2026-08-14 迁入),既有决定不重开:composition 译「组合」不译「复合」,identity morphism 统一「恒等态射」。

## 范畴基础

| 英文 | 中文 | 约定 | 首现 |
| --- | --- | --- | --- |
| category | 范畴 | 译 | [category](../categories/category/) |
| object | 对象 | 译 | [category](../categories/category/) |
| morphism | 态射 | 译;与「箭头」混用,跟随语境 | [category](../categories/category/) |
| arrow | 箭头 | 译;与「态射」同义 | [category](../categories/category/) |
| composition | 组合 | 译「组合」,**不用「复合」**(沿承旧译决定);「复合类型」(compound type)是另一概念,不受此约束 | [category](../categories/category/) |
| associativity | 结合律 | 译 | [category](../categories/category/) |
| identity morphism | 恒等态射 | 译;**不用「恒等箭头」「单位箭头」** | [category](../categories/category/) |
| free category | 自由范畴 | 译 | free-category |
| hom-set | 同态集 | 译,首次出现括注 hom-set | hom-set |
| monoid | 幺半群 | 译;不用「独异点」 | monoid |
| preorder / partial order / total order | 预序 / 偏序 / 全序 | 译 | order-categories |
| identity function | 恒等函数 | 译;指编程语言里的 id 实现 | category |
| pure function | 纯函数 | 译 | pure-functions |
| side effect | 副作用 | 译 | writer-category |
| memoization | 记忆化 | 译 | pure-functions |
| bottom (⊥) | 底 | 译,首次出现括注 ⊥ | types-as-sets |
| unit type `()` | unit | 保留英文 | void-unit-bool |
| extensional equality | 外延相等 | 译 | [category](../categories/category/) |
| Kleisli category | Kleisli 范畴 | 人名保留英文 | writer-category |
| embellished function | 装饰函数 | 译,首次出现括注英文 | writer-category |

## 泛构造与 ADT

| 英文 | 中文 | 约定 | 首现 |
| --- | --- | --- | --- |
| universal construction | 泛构造 | 译;不用「通用构造」 | universal-construction |
| initial object | 初始对象 | 译;不用「初对象/始对象」 | initial-terminal |
| terminal object | 终端对象 | 译;不用「终对象」 | initial-terminal |
| duality | 对偶性 | 译 | duality |
| opposite category | 对偶范畴 | 译,记号 $C^{op}$ | duality |
| isomorphism | 同构 | 译 | isomorphism |
| product | 积 | 译 | product |
| coproduct | 余积 | 译;不用「上积」 | coproduct |
| sum type | 和类型 | 译 | sum-types |
| product type | 积类型 | 译 | product-types |
| tagged union | 带标签的联合类型 | 译 | sum-types |
| record | 记录 | 译 | product-types |
| algebra of types | 类型代数 | 译 | algebra-of-types |

## 函子与自然变换

| 英文 | 中文 | 约定 | 首现 |
| --- | --- | --- | --- |
| functor | 函子 | 译 | functor |
| endofunctor | 自函子 | 译 | functor |
| functor laws | 函子法则 | 译 | functor-laws |
| lift (a function) | 提升 | 译 | functor |
| image | 像 | 译 | functor |
| type constructor | 类型构造器 | 译;不用「构造子」 | functor |
| data constructor | 数据构造器 | 译 | functor |
| typeclass | 类型类 | 译 | haskell-notation |
| instance | 实例 | 译 | haskell-notation |
| partial application | 部分应用 | 译 | currying |
| currying | 柯里化 | 译 | currying |
| reader functor | Reader 函子 | 半保留 | reader-functor |
| Const functor | Const 函子 | 半保留 | const-functor |
| higher-kinded types (HKT) | 高阶类型 | 译,首次出现括注 HKT | hkt-in-rust |
| GAT (generic associated types) | 泛型关联类型 | 译,首次出现括注 GAT | hkt-in-rust |
| bifunctor | 双函子 | 译 | bifunctor |
| profunctor | Profunctor | 保留英文 | profunctor |
| natural transformation | 自然变换 | 译 | natural-transformation |
| naturality | 自然性 | 译 | naturality |
| parametricity | 参数性 | 译 | parametricity |
| polymorphism | 多态 | 译 | rust-type-system |
| exponential object | 指数对象 | 译 | exponential |
| cartesian closed category | 笛卡尔闭范畴 | 译 | cartesian-closed |
| Curry-Howard isomorphism | Curry-Howard 同构 | 人名保留英文 | curry-howard |

## 结构与高阶组合

| 英文 | 中文 | 约定 | 首现 |
| --- | --- | --- | --- |
| limit / colimit | 极限 / 余极限 | 译 | cone-limit |
| cone / cocone | 锥 / 余锥 | 译 | cone-limit |
| free monoid | 自由幺半群 | 译 | free-monoid |
| representable functor | 可表示函子 | 译 | representable-functor |
| Yoneda lemma | Yoneda 引理 | 人名保留英文 | yoneda-lemma |
| adjunction | 伴随 | 译 | adjunction |
| left/right adjoint | 左伴随 / 右伴随 | 译 | adjunction |
| forgetful functor | 遗忘函子 | 译 | free-forgetful |
| monad | 单子 | 译,首次出现括注 monad | monad |
| catamorphism | catamorphism | 保留英文,正文用「折叠」作直觉词 | catamorphism |
| F-algebra | F-代数 | 半保留 | f-algebra |
| fixed point | 不动点 | 译 | f-algebra |
| small category | 小范畴 | 译 | functor-composition |
| Kan extension | Kan 扩展 | 人名保留英文 | kan-extensions |
| enriched category | 富化范畴 | 译 | enriched-categories |
| end / coend | End / Coend | 保留英文 | ends-coends |
| topos | topos | 保留英文小写 | topos |
