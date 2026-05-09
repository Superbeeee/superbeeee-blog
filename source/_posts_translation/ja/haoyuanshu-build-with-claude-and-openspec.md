---
title: "SDD 開発フロー実践：Claude のツール群で誦経記録アプリ「好願書」を作る（iOS）"
date: 2026-05-08 14:30:00
lang: ja
translation_key: haoyuanshu-build-with-claude-and-openspec
categories:
  - 技術
tags:
  - AI
  - Claude Code
  - Claude Design
  - openspec
  - React Native
  - Expo
---

子どもの頃、祖母が念珠を回しながらお経を唱え、小さなカウンターで回数を記録していたのを覚えている。大人になって自分も心経を唱えるようになり、回向の対象や目的が違うたびに既存アプリでは使いにくいと感じ、二つの週末を使って自分用のアプリを作った。Claude Design で UI を発想し、openspec で仕様を固め、Claude Code で React Native + Expo を実装し、最後は自分の iPhone で検証した。

もう一つの動機は **SDD（Spec-Driven Development、仕様駆動開発）** をこのプロジェクトで実際に試すことだった。先に spec を書き、AI に spec 通りに実装させる ── このやり方が本当に vibe coding より安定して追跡しやすいのかを確かめたかった。

<!-- more -->

> 翻訳作業中。中国語版の[元記事](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/)もご覧ください。
