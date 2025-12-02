.PHONY: posts clean-posts

posts:
	node scripts/build_posts.mjs

clean-posts:
	rm -f html_posts/*.html
